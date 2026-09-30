import re

with open("src/components/MentionInput.tsx", "r") as f:
    content = f.read()

# Fix the broken regex
content = content.replace("match(/@([^@\\[\\]]*)$/)", "match(/@([^@\\[\\]\\\\n\\\\r]*)$/)")

with open("src/components/MentionInput.tsx", "w") as f:
    f.write(content)
