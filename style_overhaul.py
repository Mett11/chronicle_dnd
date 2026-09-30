import os
import re

directories = ["src/pages", "src/components"]

replacements = [
    # Remove clunky card borders and backgrounds from Home
    (r'className={`group relative p-5 transition-all flex flex-col gap-4 rounded-lg border \$\{[^}]+\}`}', 
     r'className="group relative py-6 transition-all flex flex-col gap-4 border-b border-[#222] hover:bg-white/[0.02]"'),
    
    # Text changes for typography hierarchy
    (r'font-semibold text-[#E5E5E5]', r'font-serif font-medium text-white/90 text-lg'),
    (r'text-\[#E5E5E5\] font-semibold text-base', r'font-serif font-medium text-white/90 text-xl'),
    
    # Remove gold colors for a more subdued look
    (r'text-\[#D4AF37\]', r'text-[#C8AA6E]'),
    (r'border-\[#D4AF37\]/30', r'border-[#C8AA6E]/30'),
    (r'border-\[#D4AF37\]/40', r'border-[#C8AA6E]/40'),
    (r'bg-\[#D4AF37\]', r'bg-[#C8AA6E]'),
    
    # Storyline specific
    (r'bg-\[#0d0d12\] border rounded-2xl p-5 shadow-xl transition-all duration-300', r'bg-transparent border-t border-[#222] pt-6 pb-2 transition-all duration-300'),
    (r'border-\[#D4AF37\]/50 shadow-\[0_0_20px_rgba\(212,175,55,0.05\)\]', r'border-[#C8AA6E]/50'),
    
    # Sessions specific
    (r'bg-\[#0b0b0f\] border border-\[#222\] rounded-3xl p-6 sm:p-8 xl:p-10 space-y-8 shadow-xl relative overflow-hidden', r'bg-transparent py-6 space-y-8 relative'),
    
    # Grids: Reduce the extreme multi-columns
    (r'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4', r'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12'),
    (r'grid-cols-1 lg:grid-cols-4 xl:grid-cols-5 gap-6', r'grid-cols-1 lg:grid-cols-3 gap-12'),
    (r'grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 xl:gap-8', r'grid-cols-1 lg:grid-cols-12 gap-8'),
    
    # If sessions was converted to lg:grid-cols-12, let's make list col-span-4 and details col-span-8
    (r'<div className="space-y-3">\s*<div className="flex items-center justify-between text-xs', r'<div className="lg:col-span-4 space-y-3">\n          <div className="flex items-center justify-between text-xs'),
    (r'<div className="lg:col-span-2 xl:col-span-3 2xl:col-span-4">', r'<div className="lg:col-span-8">'),
    
    # Home column adjustments
    (r'<div className="lg:col-span-3 xl:col-span-4 space-y-8">', r'<div className="lg:col-span-2 space-y-8">'),
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
