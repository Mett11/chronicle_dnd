import os
import re

directories = ["src/pages", "src/components"]

replacements = [
    # Storyline timeline nodes: remove outer border and background
    (r'w-full bg-\[#0d0d12\] border rounded-2xl p-5 shadow-xl transition-all duration-300 flex flex-col gap-3 relative',
     r'w-full bg-transparent flex flex-col gap-3 relative py-4 border-b border-[#222]'),
    (r'bg-transparent border-t border-\[#222\] pt-6 pb-2 transition-all duration-300',
     r'w-full bg-transparent flex flex-col gap-3 relative py-6 border-b border-[#222] group'),
    (r"isExpanded\s*\?\s*'[^']+'\s*:\s*'[^']+'", "''"),
    
    # Storyline specific borders
    (r'bg-transparent border-b border-\[#222\] text-\[#C8AA6E\] border border-\[#C8AA6E\]/30', r'text-[#C8AA6E] font-medium'),
    (r'border border-\[#D4AF37\]/25', r'border-transparent'),
    
    # Simplify entity chip styles globally
    (r'bg-\[#111\] hover:bg-\[#D4AF37\]/20 text-\[#D4AF37\] hover:text-white border border-\[#D4AF37\]/30 hover:border-\[#D4AF37\]/70',
     r'bg-white/5 hover:bg-white/10 text-[#C8AA6E] border-transparent'),
    
    (r'bg-transparent border-b border-\[#222\] text-\[#C8AA6E\] text-\[9px\] font-mono font-bold border border-\[#C8AA6E\]/30',
     r'text-[#C8AA6E] text-[10px] font-mono'),
]

for directory in directories:
    for root, _, files in os.walk(directory):
        for file in files:
            if not file.endswith(".tsx"): continue
            path = os.path.join(root, file)
            with open(path, "r") as f:
                content = f.read()
                
            original_content = content
            for old, new in replacements:
                content = re.sub(old, new, content)
                
            if content != original_content:
                with open(path, "w") as f:
                    f.write(content)
                print(f"Updated {path}")
