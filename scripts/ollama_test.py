import httpx, json, asyncio

async def main():
    text = """
    회의를 시작하겠습니다. 이번 주 프로젝트 진행 상황을 공유하겠습니다.
    API 연동은 거의 완료되었고 UI 수정 작업이 남아 있습니다.
    다음 주까지 테스트를 마무리하겠습니다.
    """
    payload = {
        "model": "qwen2.5:3b-instruct-q4_K_M",
        "prompt": f"다음 내용을 간단히 요약해줘:\n{text}",
        "stream": False
    }
    async with httpx.AsyncClient() as client:
        res = await client.post("http://localhost:11434/api/generate", json=payload)
        print(json.dumps(res.json(), indent=2, ensure_ascii=False))

if __name__ == "__main__":
    asyncio.run(main())
