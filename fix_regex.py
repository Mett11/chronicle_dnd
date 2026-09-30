with open("src/components/MentionInput.tsx", "r") as f:
    content = f.read()

content = content.replace("textBeforeCursor.match(/@([^@\\[\\]\\n\\r]*)$/);]*)$/);", "textBeforeCursor.match(/@([^@\\[\\]\\\\n\\\\r]*)$/);")

with open("src/components/MentionInput.tsx", "w") as f:
    f.write(content)
