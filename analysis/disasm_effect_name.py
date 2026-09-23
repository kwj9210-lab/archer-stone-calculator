from capstone import Cs,CS_ARCH_ARM64,CS_MODE_ARM
import re
src=r'''01a8fcf8: fe 0f 1e f8 f4 4f 01 a9 b4 2e 01 f0 f3 03 00 2a
01a8fd08: 88 42 74 39 28 01 00 37 80 1a 01 f0 00 e8 40 f9
01a8fd18: 9b 54 f6 97 a0 1a 01 f0 00 98 44 f9 98 54 f6 97
01a8fd28: 28 00 80 52 88 42 34 39 73 03 f8 37 94 1a 01 f0
01a8fd38: 94 ea 40 f9 80 02 40 f9 08 e4 40 b9 68 00 00 35
01a8fd48: e3 54 f6 97 80 02 40 f9 08 5c 40 f9 08 31 40 f9
01a8fd58: e8 02 00 b4 09 19 40 b9 3f 01 13 6b cd 01 00 54
01a8fd68: 09 e4 40 b9 c9 00 00 35 d9 54 f6 97 88 02 40 f9
01a8fd78: 08 5d 40 f9 08 31 40 f9 a8 01 00 b4 09 19 40 b9
01a8fd88: 3f 01 13 6b 69 01 00 54 08 4d 33 8b 08 81 00 91
01a8fd98: 03 00 00 14 a8 1a 01 f0 08 99 44 f9 f4 4f 41 a9
01a8fda8: 00 01 40 f9 fe 07 42 f8 c0 03 5f d6 13 55 f6 97
01a8fdb8: 14 55 f6 97'''
data=bytearray()
for line in src.splitlines():
    m=re.match(r'^[0-9a-fA-F]+:\s*(.*)$',line)
    if m: data.extend(int(x,16) for x in m.group(1).split())
md=Cs(CS_ARCH_ARM64,CS_MODE_ARM)
for ins in md.disasm(bytes(data),0x1A93CF8):
    print(f"{ins.address:08x}  {ins.mnemonic:8s} {ins.op_str}")
