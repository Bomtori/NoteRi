#!/usr/bin/env python3
"""
임베딩 모델 메모리 사용량 측정
"""
import psutil
import torch
from sentence_transformers import SentenceTransformer
import time

def get_memory_usage():
    """현재 프로세스 메모리 사용량 (MB)"""
    process = psutil.Process()
    return process.memory_info().rss / (1024 * 1024)

def get_gpu_memory():
    """GPU 메모리 사용량 (MB)"""
    if torch.cuda.is_available():
        return torch.cuda.memory_allocated() / (1024 * 1024)
    return 0

print("=" * 60)
print("🔍 임베딩 모델 메모리 사용량 측정")
print("=" * 60)

# 1. 초기 상태
print("\n1️⃣ 초기 상태 (모델 로딩 전)")
initial_ram = get_memory_usage()
initial_gpu = get_gpu_memory()
print(f"   RAM: {initial_ram:.2f} MB")
print(f"   GPU: {initial_gpu:.2f} MB")

# 2. 모델 로딩
print("\n2️⃣ 모델 로딩 중...")
start_time = time.time()

model = SentenceTransformer('jhgan/ko-sbert-nli')
if torch.cuda.is_available():
    model = model.to('cuda')

load_time = time.time() - start_time
after_load_ram = get_memory_usage()
after_load_gpu = get_gpu_memory()

print(f"   로딩 시간: {load_time:.2f}초")
print(f"   RAM: {after_load_ram:.2f} MB")
print(f"   GPU: {after_load_gpu:.2f} MB")

# 3. 메모리 증가량
print("\n3️⃣ 메모리 증가량")
ram_increase = after_load_ram - initial_ram
gpu_increase = after_load_gpu - initial_gpu
print(f"   RAM 증가: {ram_increase:.2f} MB")
print(f"   GPU 증가: {gpu_increase:.2f} MB")

# 4. 임베딩 생성 테스트
print("\n4️⃣ 임베딩 생성 테스트")
test_text = "안녕하세요. 테스트 문장입니다." * 10  # 긴 텍스트

start_time = time.time()
embedding = model.encode(test_text)
encode_time = time.time() - start_time

after_encode_ram = get_memory_usage()
after_encode_gpu = get_gpu_memory()

print(f"   인코딩 시간: {encode_time:.4f}초")
print(f"   RAM: {after_encode_ram:.2f} MB")
print(f"   GPU: {after_encode_gpu:.2f} MB")
print(f"   임베딩 차원: {len(embedding)}")

# 5. 모델 유지 vs 매번 로딩 비교
print("\n5️⃣ 모델 유지 vs 매번 로딩")
print(f"   모델 유지 시 메모리: {after_load_ram:.2f} MB (RAM) + {after_load_gpu:.2f} MB (GPU)")
print(f"   매번 로딩 시 시간: 약 {load_time:.2f}초")

# 6. 결론
print("\n" + "=" * 60)
print("💡 결론")
print("=" * 60)

total_memory = ram_increase + gpu_increase

if total_memory < 500:
    print(f"✅ 메모리 사용량이 적음 ({total_memory:.0f}MB)")
    print("   → 서버 시작 시 미리 로딩 추천 ⭐⭐⭐⭐⭐")
    print(f"   → 로딩 시간 절약: {load_time:.2f}초")
elif total_memory < 1000:
    print(f"⚠️ 메모리 사용량 보통 ({total_memory:.0f}MB)")
    print("   → 동시 세션 수에 따라 결정")
    print(f"   → 10명 이하: 미리 로딩 추천")
    print(f"   → 10명 이상: 필요 시 로딩")
else:
    print(f"❌ 메모리 사용량 많음 ({total_memory:.0f}MB)")
    print("   → 필요할 때만 로딩 추천")
    print(f"   → 로딩 시간은 감수: {load_time:.2f}초")

print("\n" + "=" * 60)

# 7. 시스템 전체 리소스
print("\n📊 시스템 전체 리소스")
print("=" * 60)
total_ram = psutil.virtual_memory().total / (1024 * 1024 * 1024)
used_ram = psutil.virtual_memory().used / (1024 * 1024 * 1024)
percent_ram = psutil.virtual_memory().percent

print(f"전체 RAM: {total_ram:.2f} GB")
print(f"사용 중: {used_ram:.2f} GB ({percent_ram:.1f}%)")

if torch.cuda.is_available():
    gpu_total = torch.cuda.get_device_properties(0).total_memory / (1024 * 1024 * 1024)
    gpu_used = torch.cuda.memory_allocated() / (1024 * 1024 * 1024)
    print(f"GPU 메모리: {gpu_used:.2f} / {gpu_total:.2f} GB")