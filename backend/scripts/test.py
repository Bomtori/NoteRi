import os

# 제외할 디렉토리/파일 목록
EXCLUDE = {
    "node_modules", ".venv", "__pycache__",
    ".git", ".idea"
}

def print_tree(start_path=".", prefix=""):
    try:
        items = os.listdir(start_path)
    except PermissionError:
        return

    # 제외 목록에 없는 것만 가져오기
    items = sorted([i for i in items if i not in EXCLUDE])

    for idx, name in enumerate(items):
        path = os.path.join(start_path, name)
        connector = "└── " if idx == len(items) - 1 else "├── "
        print(prefix + connector + name)

        if os.path.isdir(path):
            extension = "    " if idx == len(items) - 1 else "│   "
            print_tree(path, prefix + extension)


if __name__ == "__main__":
    print_tree("..")