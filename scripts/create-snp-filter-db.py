import sys
import re
import sqlite3
from sqlite3 import Error
import os

def create_db(db_file):
    """ create a database connection to the SQLite database
        specified by db_file
    :param db_file: database file
    :return: Connection object or None
    """
    conn = None
    try:
        conn = sqlite3.connect(db_file)
    except Error as e:
        print(e)

    return conn

def create_table(conn):
    sql = ''' CREATE TABLE rsids (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rsid VARCHAR(50) NOT NULL
            ); '''
    cur = conn.cursor()
    cur.execute(sql)
    sql_idx = ("CREATE INDEX rsid_idx ON rsids (rsid);")
    cur.execute(sql_idx)

def insert_rsid(conn, rsid):
    """
    Create a new row into the rsids table
    :param conn:
    :param rsid:
    :return: rsid id
    """
    sql = ''' INSERT INTO rsids (rsid)
              VALUES (?) '''
    cur = conn.cursor()
    cur.execute(sql, rsid)
    conn.commit()
    return cur.lastrowid


def main():
    # pass in snp data file path
    try:
        snp_file = sys.argv[1]
    except IndexError:
        sys.exit("Missing SNP data file.\nPlease provide as first argument (i.e. python3 create-snp-filter.py </path/to/snp_file.txt> </path/to/output_file.db>")

    # pass in output db file path
    try:
        db_file = sys.argv[2]
    except IndexError:
        sys.exit("Missing DB output path.\nPlease provide as second argument (i.e. python3 create-snp-filter.py </path/to/snp_file.txt> </path/to/output_file.db>")

    # check if db file path already exists
    if os.path.exists(db_file):
        os.remove(db_file)
        print("DB already exists. Removed.")
        # sys.exit("DB already exists. Exiting.")

    conn = create_db(db_file)
    with conn:
        # create schema
        create_table(conn)

        snps_processed_count = 0
        valid_snps_count = 0
        invalid_snps = []
        
        # read file
        with open(snp_file, "r") as fp:
            for line in fp:
                snp = line.strip()
                snps_processed_count += 1
                # check snp rsid format
                if re.match(r"^rs\d+$", snp):
                    valid_snps_count += 1
                    # insert to sqlite db
                    rsid_id = insert_rsid(conn, (snp,))
                    print(snp + " inserted!", rsid_id)
                else:
                    invalid_snps.append(snp)
    
    print("# snps processed", f"{snps_processed_count:,}")
    print("# valid SNPs", f"{valid_snps_count:,}")
    print("# invalid SNPs", f"{len(invalid_snps):,}")
    print("invalid SNPs", invalid_snps)

if __name__ == "__main__":
    # execute only if run as a script
    main()