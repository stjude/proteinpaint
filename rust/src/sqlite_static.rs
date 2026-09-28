// Safer preparation of sqlite statements.
//
// prepare_static() only accepts a &'static str, such as a string literal, so that a sql string
// that is built at runtime from request values, e.g. with format!() or "...".to_owned() + &value,
// does not compile. Values must instead be bound as parameters:
//
//     let mut stmt = prepare_static(&conn, "select id from terms where parent_id=?")?;
//     let rows = stmt.query_map([&genesetgroup], |row| row.get::<_, String>(0))?;
//
// clippy.toml disallows calling rusqlite's Connection::prepare() and other methods that accept
// a sql string directly, see the clippy step in .github/workflows/CI-unit.yml

use rusqlite::{Connection, Result, Statement};

/// prepares a statement from a static sql string, see the comment at the top of this file
#[allow(clippy::disallowed_methods)] // the only place allowed to call Connection::prepare()
pub fn prepare_static<'conn>(conn: &'conn Connection, sql: &'static str) -> Result<Statement<'conn>> {
    conn.prepare(sql)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[allow(clippy::disallowed_methods)] // static test fixture
    fn get_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "create table terms (id text, parent_id text);
            insert into terms values ('a', 'GO'), ('b', 'GO'), ('c', 'KEGG');",
        )
        .unwrap();
        conn
    }

    #[test]
    fn binds_values_as_parameters() {
        let conn = get_conn();
        let mut stmt = prepare_static(&conn, "select id from terms where parent_id=? order by id").unwrap();
        let ids: Vec<String> = stmt
            .query_map(["GO"], |row| row.get(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect();
        assert_eq!(ids, vec!["a", "b"]);
    }

    #[test]
    fn does_not_execute_an_injected_value() {
        let conn = get_conn();
        let mut stmt = prepare_static(&conn, "select id from terms where parent_id=?").unwrap();
        // if this value were written into the sql text, it would match every row
        let n = stmt
            .query_map(["x' OR '1'='1"], |row| row.get::<_, String>(0))
            .unwrap()
            .count();
        assert_eq!(n, 0);
    }
}
