import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
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
  const { db } = store;
  db.exec(`CREATE TABLE IF NOT EXISTS Business(id INTEGER PRIMARY KEY,name TEXT NOT NULL);
    INSERT OR IGNORE INTO Business VALUES(1,'Demo retailer');
    CREATE TABLE IF NOT EXISTS BusinessVendor(business_id INTEGER REFERENCES Business(id),vendor_id INTEGER UNIQUE REFERENCES Vendor(vendor_id),PRIMARY KEY(business_id,vendor_id));`);
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
          "SELECT id,name,username,role,must_change FROM AppUser WHERE business_id=? AND active=1 ORDER BY role,id",
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
          `SELECT substr(t.datetime,1,10) date,CAST(round(t.value*100) AS INTEGER) valueMinor,t.vendor_id locationId,t.discount discount FROM "Transaction" t JOIN BusinessVendor b ON b.vendor_id=t.vendor_id WHERE b.business_id=? ORDER BY t.datetime,t.transaction_id`,
        )
        .all(u.businessId),
  });
}
