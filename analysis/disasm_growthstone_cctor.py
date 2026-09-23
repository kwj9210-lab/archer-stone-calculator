from capstone import Cs,CS_ARCH_ARM64,CS_MODE_ARM
import re
src=r'''01e9d63c: ff 03 01 d1 fe 0b 00 f9 f6 57 02 a9 f4 4f 03 a9
01e9d64c: 56 0e 01 f0 75 fa 00 b0 f3 fa 00 f0 54 fa 00 b0
01e9d65c: b5 42 41 f9 c8 d6 4f 39 73 ea 41 f9 94 56 43 f9
01e9d66c: 88 01 00 37 40 fa 00 b0 00 54 43 f9 43 1e e6 97
01e9d67c: 60 fa 00 b0 00 40 41 f9 40 1e e6 97 e0 fa 00 f0
01e9d68c: 00 e8 41 f9 3d 1e e6 97 28 00 80 52 c8 d6 0f 39
01e9d69c: 28 54 ff d0 08 41 13 91 a0 02 40 f9 00 01 c0 3d
01e9d6ac: e1 03 00 91 e0 03 80 3d 66 1e e6 97 61 02 40 f9
01e9d6bc: e2 03 1f aa f3 03 00 aa 63 58 49 94 88 02 40 f9
01e9d6cc: e1 03 13 aa 00 5d 40 f9 13 8c 00 f8 14 1e e6 97
01e9d6dc: f4 4f 43 a9 fe 0b 40 f9 f6 57 42 a9 ff 03 01 91'''
data=bytearray()
for line in src.splitlines():
 m=re.match(r'^[0-9a-fA-F]+:\s*(.*)$',line)
 if m:data.extend(int(x,16) for x in m.group(1).split())
for ins in Cs(CS_ARCH_ARM64,CS_MODE_ARM).disasm(bytes(data),0x1EA163C):
 print(f"{ins.address:08x}  {ins.mnemonic:8s} {ins.op_str}")
