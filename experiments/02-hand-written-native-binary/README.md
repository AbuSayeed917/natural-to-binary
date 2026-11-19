# A native program written byte by byte

`hello.hex` is a complete 178-byte Linux x86-64 program, written directly as machine bytes with no assembler, compiler or language. It prints `Made of bytes, not code.` and exits.

| Bytes | Meaning |
|---|---|
| 64 | ELF header: "this is a program" |
| 56 | program header: where to load it in memory |
| 33 | x86-64 instructions: write the message, then exit |
| 25 | the message itself |

## Run it (Linux x86-64)

```bash
python3 -c "import sys;open('hello','wb').write(bytes.fromhex(open('hello.hex').read().strip()))"
chmod +x hello && ./hello
```

It won't run on macOS or Apple-chip Macs. They need a different file layout and different instructions, which is part of why the rest of this project targets WebAssembly.
