#!/usr/bin/env python3
import getpass,sys,sqlite3
from app import init,conn,hashpw
init()
name=input('Admin username (3-40 English letters/numbers/_): ').strip()
if not (3<=len(name)<=40 and all(c.isascii() and (c.isalnum() or c=='_') for c in name)):
 sys.exit('Invalid username')
p=getpass.getpass('Admin password (at least 10 characters): ')
if len(p)<10:sys.exit('Password too short')
with conn() as c:
 try:c.execute('INSERT INTO users(username,password_hash,role,verified) VALUES(?,?,?,1)',(name,hashpw(p),'admin'))
 except sqlite3.IntegrityError:sys.exit('Username exists')
print('Admin account created.')
