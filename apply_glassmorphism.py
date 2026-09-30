import os
import re

for root, _, files in os.walk("src"):
    for file in files:
        if not file.endswith(".tsx"): continue
        path = os.path.join(root, file)
        with open(path, "r") as f:
            content = f.read()

        # 1. Fix Modal Overlays (Backdrop Blur)
        content = re.sub(
            r'className="fixed inset-0[^"]*"',
            r'className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-black/40 backdrop-blur-md"',
            content
        )
        # Handle cases where className is inside `{...}` but starts with "fixed inset-0"
        content = re.sub(
            r'className={`fixed inset-0[^`]*`}',
            r'className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-black/40 backdrop-blur-md"',
            content
        )

        # 2. Fix Modal/Popup Containers (Glassmorphism inner)
        # Search for typical modal inner container classes
        # Modals usually have `max-w-3xl`, `max-w-2xl`, `max-w-lg`, `max-w-xl`, `max-w-4xl`
        content = re.sub(
            r'className="([^"]*max-w-[x0-9a-z]+ w-full[^"]*)"',
            lambda m: 'className="' + re.sub(r'bg-\[[^\]]+\]/?\d*|bg-\w+-\d+/?\d*|bg-transparent|border-\[\#222\]|border-\[\#D4AF37\]/\d+|shadow-sm|shadow-md|shadow-xl|shadow-none', '', m.group(1)).replace('  ', ' ') + ' bg-[#0c0c0c]/70 backdrop-blur-xl border border-white/10 shadow-2xl"',
            content
        )
        
        # Other common popup containers
        if file == "Layout.tsx":
            # Header
            content = content.replace(
                'className="shrink-0 h-14 bg-[#0a0a0a] border-b border-[#222] flex items-center justify-between px-4 sm:px-6 relative z-40"',
                'className="shrink-0 h-14 bg-black/40 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-4 sm:px-6 relative z-40"'
            )
            # Bottom Dock
            content = content.replace(
                'className="pointer-events-auto flex items-center gap-1 sm:gap-2 px-3 py-2 bg-[#0a0a0a] border border-[#222] rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.5)]"',
                'className="pointer-events-auto flex items-center gap-1 sm:gap-2 px-3 py-2 bg-black/50 backdrop-blur-2xl border border-white/10 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.5)]"'
            )
            # Codex/Profile Popovers
            content = content.replace(
                'className="absolute bottom-24 bg-[#0a0a0a] border border-[#222] rounded-2xl p-3 shadow-2xl flex flex-col gap-1 w-60 pointer-events-auto"',
                'className="absolute bottom-24 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl p-3 shadow-[0_0_40px_rgba(0,0,0,0.5)] flex flex-col gap-1 w-60 pointer-events-auto"'
            )
            content = content.replace(
                'className="absolute bottom-24 right-4 sm:right-auto bg-[#0a0a0a] border border-[#222] rounded-2xl p-4 shadow-2xl flex flex-col gap-3 w-64 pointer-events-auto"',
                'className="absolute bottom-24 right-4 sm:right-auto bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-[0_0_40px_rgba(0,0,0,0.5)] flex flex-col gap-3 w-64 pointer-events-auto"'
            )
            # Replace sub-items hover in Layout
            content = content.replace(
                "bg-white/10 text-white", "bg-white/15 text-white shadow-sm"
            )

        with open(path, "w") as f:
            f.write(content)

