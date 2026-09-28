import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { validateImport } from "./importer.mjs";
const fail = (message) => {
  throw Error(message);
};
const name = (value) =>
  typeof value === "string" &&
  value.trim().length >= 2 &&
  value.trim().length <= 120
    ? value.trim()
    : fail("Enter a name of 2–120 characters.");
const email = (value) =>
  typeof value === "string" &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) &&
  value.length <= 120
    ? value.trim().toLowerCase()
    : fail("Enter a valid email address.");
export function extendAccounts(store) {
  const { db } = store,
    inheritedCoverage = store.coverage;
  db.exec(`CREATE TABLE IF NOT EXISTS Business(id INTEGER PRIMARY KEY,name TEXT NOT NULL);
    INSERT OR IGNORE INTO Business VALUES(1,'Demo retailer');
    CREATE TABLE IF NOT EXISTS BusinessVendor(business_id INTEGER REFERENCES Business(id),vendor_id INTEGER UNIQUE REFERENCES Vendor(vendor_id),PRIMARY KEY(business_id,vendor_id));
    CREATE TABLE IF NOT EXISTS ImportLocation(business_id INTEGER REFERENCES Business(id),external_id TEXT,vendor_id INTEGER UNIQUE REFERENCES Vendor(vendor_id),PRIMARY KEY(business_id,external_id));
    CREATE TABLE IF NOT EXISTS ImportTransaction(business_id INTEGER REFERENCES Business(id),external_id TEXT,transaction_id INTEGER UNIQUE REFERENCES "Transaction"(transaction_id),PRIMARY KEY(business_id,external_id));
    CREATE TABLE IF NOT EXISTS BusinessDataset(business_id INTEGER PRIMARY KEY REFERENCES Business(id),coverage_from TEXT NOT NULL,coverage_to TEXT NOT NULL,timezone TEXT NOT NULL,hourly_reliable INTEGER NOT NULL DEFAULT 0,discount_semantics TEXT NOT NULL DEFAULT 'unavailable',updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS RecoveryCode(user_id INTEGER PRIMARY KEY REFERENCES AppUser(id),code_hash TEXT NOT NULL,created_at TEXT NOT NULL);`);
  const columns = new Set(
    db
      .prepare("PRAGMA table_info(AppUser)")
      .all()
      .map((c) => c.name),
  );
  // SQLite cannot add a REFERENCES column with a non-null default to populated tables.
  // Existing users keep demo business 1; validation triggers enforce the relationship.
  for (const [column, definition] of [
    ["business_id", "INTEGER NOT NULL DEFAULT 1"],
    ["must_change", "INTEGER NOT NULL DEFAULT 0"],
    ["active", "INTEGER NOT NULL DEFAULT 1"],
  ])
    if (!columns.has(column))
      db.exec(`ALTER TABLE AppUser ADD COLUMN ${column} ${definition}`);
  db.exec(`CREATE TRIGGER IF NOT EXISTS user_business_insert BEFORE INSERT ON AppUser WHEN NOT EXISTS(SELECT 1 FROM Business WHERE id=NEW.business_id) BEGIN SELECT RAISE(ABORT,'Business not found'); END;
    CREATE TRIGGER IF NOT EXISTS user_business_update BEFORE UPDATE OF business_id ON AppUser WHEN NOT EXISTS(SELECT 1 FROM Business WHERE id=NEW.business_id) BEGIN SELECT RAISE(ABORT,'Business not found'); END;`);
  db.exec(
    "INSERT OR IGNORE INTO BusinessVendor SELECT 1,vendor_id FROM Vendor",
  );
  const owner = (u) => {
    if (!u.canManageTeam) {
      const e = Error("Only owners can manage the team.");
      e.status = 403;
      throw e;
    }
  };
  const transaction = (fn) => {
    db.exec("BEGIN");
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };
  const add = (b, businessId, role, mustChange) => {
    const username = email(b.email);
    if (db.prepare("SELECT id FROM AppUser WHERE username=?").get(username))
      fail("That email cannot be used. Choose another or contact your owner.");
    store.addUser({ username, name: name(b.name), role, password: b.password });
    db.prepare(
      "UPDATE AppUser SET business_id=?,must_change=? WHERE username=?",
    ).run(businessId, mustChange, username);
    return username;
  };
  const temporaryPassword = (value) => {
    if (
      typeof value !== "string" ||
      value.length < 12 ||
      value.length > 256
    )
      fail("Temporary passwords must contain 12–256 characters.");
    return value;
  };
  const replacementPassword = (password, confirm) => {
    if (
      typeof password !== "string" ||
      password.length < 12 ||
      password.length > 256 ||
      password !== confirm
    )
      fail("Passwords must match and contain 12–256 characters.");
    return password;
  };
  return Object.assign(store, {
    register: (b) =>
      transaction(() => {
        const id = Number(
          db
            .prepare("INSERT INTO Business(name) VALUES(?)")
            .run(name(b.business)).lastInsertRowid,
        );
        return add(b, id, "manager", 0);
      }),
    team: (u) => {
      owner(u);
      return db
        .prepare(
          "SELECT id,name,username,role,must_change,active FROM AppUser WHERE business_id=? ORDER BY active DESC,role,id",
        )
        .all(u.businessId);
    },
    addMember: (u, b) => {
      owner(u);
      return transaction(() => {
        const username = add(b, u.businessId, "reporting", 1);
        store.audit(u.id, "member_added");
        return username;
      });
    },
    removeMember: (u, id) => {
      owner(u);
      const target = db
        .prepare(
          "SELECT id FROM AppUser WHERE id=? AND business_id=? AND role='reporting' AND active=1",
        )
        .get(Number(id), u.businessId);
      if (!target) fail("Member not found.");
      transaction(() => {
        db.prepare("DELETE FROM Session WHERE user_id=?").run(target.id);
        db.prepare("UPDATE AppUser SET active=0 WHERE id=?").run(target.id);
        store.audit(u.id, "member_removed");
      });
    },
    resetMember: (u, b) => {
      owner(u);
      const target = db
        .prepare(
          "SELECT id FROM AppUser WHERE id=? AND business_id=? AND role='reporting'",
        )
        .get(Number(b.id), u.businessId);
      if (!target) fail("Member not found.");
      const password = temporaryPassword(b.password),
        salt = randomBytes(16).toString("hex");
      transaction(() => {
        db.prepare("DELETE FROM Session WHERE user_id=?").run(target.id);
        db.prepare(
          "UPDATE AppUser SET salt=?,password_hash=?,must_change=1,active=1 WHERE id=?",
        ).run(
          salt,
          scryptSync(password, salt, 64).toString("hex"),
          target.id,
        );
        store.audit(u.id, "member_access_reset");
      });
    },
    issueRecoveryCode: (u) => {
      if (u.role !== "manager") {
        const e = Error("Recovery codes are available to owners only.");
        e.status = 403;
        throw e;
      }
      const code = randomBytes(24).toString("base64url"),
        codeHash = createHash("sha256").update(code).digest("hex");
      db.prepare(
        "INSERT INTO RecoveryCode VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET code_hash=excluded.code_hash,created_at=excluded.created_at",
      ).run(u.id, codeHash, new Date().toISOString());
      store.audit(u.id, "recovery_code_created");
      return code;
    },
    recoverOwner: (b) => {
      const username =
          typeof b.username === "string"
            ? b.username.trim().toLowerCase()
            : "",
        password = replacementPassword(b.password, b.confirm),
        codeHash =
          typeof b.code === "string"
            ? createHash("sha256").update(b.code.trim()).digest("hex")
            : "";
      const row = db
        .prepare(
          "SELECT u.*,r.code_hash FROM AppUser u JOIN RecoveryCode r ON r.user_id=u.id WHERE u.username=? AND u.role='manager' AND u.active=1",
        )
        .get(username);
      const matches =
        row &&
        timingSafeEqual(
          Buffer.from(row.code_hash, "hex"),
          Buffer.from(codeHash.padEnd(64, "0").slice(0, 64), "hex"),
        );
      if (!matches) {
        const e = Error("The recovery details are incorrect or expired.");
        e.status = 401;
        throw e;
      }
      const salt = randomBytes(16).toString("hex");
      transaction(() => {
        db.prepare("DELETE FROM Session WHERE user_id=?").run(row.id);
        db.prepare("DELETE FROM RecoveryCode WHERE user_id=?").run(row.id);
        db.prepare(
          "UPDATE AppUser SET salt=?,password_hash=?,must_change=0 WHERE id=?",
        ).run(salt, scryptSync(password, salt, 64).toString("hex"), row.id);
        store.audit(row.id, "password_recovered");
      });
      return store.authenticate(username, password);
    },
    importDataset: (u, payload) => {
      owner(u);
      const data = validateImport(payload);
      transaction(() => {
        db.prepare("INSERT OR IGNORE INTO Vendor_Type VALUES(?,?)").run(
          1,
          "Imported vendor",
        );
        const locationMap = new Map();
        for (const location of data.locations) {
          let mapped = db
            .prepare(
              "SELECT vendor_id FROM ImportLocation WHERE business_id=? AND external_id=?",
            )
            .get(u.businessId, location.id);
          if (!mapped) {
            const vendorId = Number(
              db
                .prepare(
                  "INSERT INTO Vendor(name,address,gps,type_id) VALUES(?,?,NULL,1)",
                )
                .run(location.name, location.address).lastInsertRowid,
            );
            db.prepare("INSERT INTO BusinessVendor VALUES(?,?)").run(
              u.businessId,
              vendorId,
            );
            db.prepare("INSERT INTO ImportLocation VALUES(?,?,?)").run(
              u.businessId,
              location.id,
              vendorId,
            );
            mapped = { vendor_id: vendorId };
          } else
            db.prepare("UPDATE Vendor SET name=?,address=? WHERE vendor_id=?").run(
              location.name,
              location.address,
              mapped.vendor_id,
            );
          locationMap.set(location.id, mapped.vendor_id);
        }
        for (const row of data.transactions) {
          const studentId = createHash("sha256")
            .update(`${u.businessId}:${row.studentKey}`)
            .digest("hex");
          db.prepare("INSERT OR IGNORE INTO Student(id_number) VALUES(?)").run(
            studentId,
          );
          const mapped = db
            .prepare(
              "SELECT transaction_id FROM ImportTransaction WHERE business_id=? AND external_id=?",
            )
            .get(u.businessId, row.id);
          const values = [
            studentId,
            locationMap.get(row.locationId),
            row.datetime,
            row.valueMinor / 100,
            row.discountMinor == null ? null : row.discountMinor / 100,
          ];
          if (mapped)
            db.prepare(
              'UPDATE "Transaction" SET student_id=?,vendor_id=?,datetime=?,value=?,discount=? WHERE transaction_id=?',
            ).run(...values, mapped.transaction_id);
          else {
            const transactionId = Number(
              db
                .prepare(
                  'INSERT INTO "Transaction"(student_id,vendor_id,datetime,value,discount) VALUES(?,?,?,?,?)',
                )
                .run(...values).lastInsertRowid,
            );
            db.prepare("INSERT INTO ImportTransaction VALUES(?,?,?)").run(
              u.businessId,
              row.id,
              transactionId,
            );
          }
        }
        db.prepare(
          `INSERT INTO BusinessDataset VALUES(?,?,?,?,?,?,?)
           ON CONFLICT(business_id) DO UPDATE SET coverage_from=excluded.coverage_from,coverage_to=excluded.coverage_to,timezone=excluded.timezone,hourly_reliable=excluded.hourly_reliable,discount_semantics=excluded.discount_semantics,updated_at=excluded.updated_at`,
        ).run(
          u.businessId,
          data.coverage.from,
          data.coverage.to,
          data.timezone,
          data.capabilities.hourlyTimestamps ? 1 : 0,
          data.capabilities.discountSemantics,
          new Date().toISOString(),
        );
        store.audit(u.id, "dataset_imported");
      });
      return {
        locations: data.locations.length,
        transactions: data.transactions.length,
      };
    },
    dataStatus: (u) => {
      const row = db
        .prepare("SELECT * FROM BusinessDataset WHERE business_id=?")
        .get(u.businessId);
      return row
        ? {
            connected: true,
            coverage: { from: row.coverage_from, to: row.coverage_to },
            timezone: row.timezone,
            hourlyTimestamps: !!row.hourly_reliable,
            discountSemantics: row.discount_semantics,
            updatedAt: row.updated_at,
          }
        : {
            connected: u.businessId === 1,
            coverage: inheritedCoverage(),
            timezone: "Africa/Johannesburg",
            hourlyTimestamps: false,
            discountSemantics: "unavailable",
            updatedAt: null,
          };
    },
    coverage: (u) => {
      const row = u
        ? db
            .prepare(
              "SELECT coverage_from,coverage_to FROM BusinessDataset WHERE business_id=?",
            )
            .get(u.businessId)
        : null;
      return row
        ? { from: row.coverage_from, to: row.coverage_to }
        : inheritedCoverage();
    },
    changePassword: (u, b) => {
      if (
        typeof b.password !== "string" ||
        b.password.length < 12 ||
        b.password.length > 256 ||
        b.password !== b.confirm
      )
        fail("Passwords must match and contain 12–256 characters.");
      const row = db.prepare("SELECT * FROM AppUser WHERE id=?").get(u.id);
      if (
        timingSafeEqual(
          scryptSync(b.password, row.salt, 64),
          Buffer.from(row.password_hash, "hex"),
        )
      )
        fail("Choose a different password from your temporary password.");
      if (!u.mustChangePassword)
        fail("This screen is for first-login password setup only.");
      const salt = randomBytes(16).toString("hex");
      transaction(() => {
        db.prepare(
          "UPDATE AppUser SET salt=?,password_hash=?,must_change=0 WHERE id=?",
        ).run(salt, scryptSync(b.password, salt, 64).toString("hex"), u.id);
        db.prepare("DELETE FROM Session WHERE user_id=?").run(u.id);
        store.audit(u.id, "password_changed");
      });
      return store.authenticate(u.username, b.password);
    },
    locations: (u) =>
      db
        .prepare(
          "SELECT v.vendor_id id,v.name,v.address FROM Vendor v JOIN BusinessVendor b ON b.vendor_id=v.vendor_id WHERE b.business_id=? ORDER BY v.vendor_id",
        )
        .all(u.businessId),
    scopedRecords: (u) =>
      db
        .prepare(
          `SELECT substr(t.datetime,1,10) date,t.datetime,CAST(round(t.value*100) AS INTEGER) valueMinor,CASE WHEN t.discount IS NULL THEN NULL ELSE CAST(round(t.discount*100) AS INTEGER) END discountMinor,t.vendor_id locationId FROM "Transaction" t JOIN BusinessVendor b ON b.vendor_id=t.vendor_id WHERE b.business_id=? ORDER BY t.datetime,t.transaction_id`,
        )
        .all(u.businessId),
  });
}
