from capstone import Cs,CS_ARCH_ARM64,CS_MODE_ARM
import re
src=r'''01e9cef0: fe 67 bc a9 f8 5f 01 a9 f6 57 02 a9 f4 4f 03 a9
01e9cf00: 76 0e 01 90 f3 03 02 2a f4 03 01 2a c8 c2 4f 39
01e9cf10: f5 03 00 2a c8 00 00 37 40 fa 00 d0 00 54 43 f9
01e9cf20: 19 20 e6 97 28 00 80 52 c8 c2 0f 39 7f 02 14 6b
01e9cf30: f6 03 1f 2a 0d 05 00 54 bf 0e 00 71 c8 04 00 54
01e9cf40: b4 04 f8 37 7f 62 09 71 6c 04 00 54 57 fa 00 d0
01e9cf50: f9 a3 90 52 f6 03 1f 2a f7 56 43 f9 f8 03 15 2a
01e9cf60: 79 3d aa 72 e0 02 40 f9 08 e4 40 b9 68 00 00 35
01e9cf70: 59 20 e6 97 e0 02 40 f9 08 5c 40 f9 08 05 40 f9
01e9cf80: 88 03 00 b4 09 09 40 f9 2a 01 40 b9 5f 01 15 6b
01e9cf90: e9 02 00 54 8a 7e 39 9b 29 09 40 f9 4b fd 7f d3
01e9cfa0: 4a fd 65 93 4a 01 0b 0b 4a 7d 40 93 5f 01 09 6b
01e9cfb0: e2 01 00 54 29 29 18 9b 08 09 09 8b 89 0a 00 11
01e9cfc0: 94 06 00 11 3f 01 13 6b 08 21 40 b9 16 01 16 0b
01e9cfd0: cd fc ff 54 e0 03 16 2a f4 4f 43 a9 f6 57 42 a9
01e9cfe0: f8 5f 41 a9 fe 67 c4 a8 c0 03 5f d6 87 20 e6 97
01e9cff0: 84 20 e6 97'''
data=bytearray()
for line in src.splitlines():
 m=re.match(r'^[0-9a-fA-F]+:\s*(.*)$',line)
 if m:data.extend(int(x,16) for x in m.group(1).split())
for ins in Cs(CS_ARCH_ARM64,CS_MODE_ARM).disasm(bytes(data),0x1EA0EF0):
 print(f"{ins.address:08x}  {ins.mnemonic:8s} {ins.op_str}")
