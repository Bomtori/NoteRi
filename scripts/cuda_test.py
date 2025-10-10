import torch
import onnxruntime as ort
from faster_whisper import WhisperModel

print("=" * 60)
print("🔍 CUDA 환경 점검 시작\n")

# 1️⃣ PyTorch CUDA 확인
print("[1] PyTorch 확인")
try:
    print(f" - torch 버전: {torch.__version__}")
    print(f" - CUDA 가능 여부: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        device_name = torch.cuda.get_device_name(0)
        print(f" - 사용 중인 GPU: {device_name}")
        print(f" - CUDA 버전: {torch.version.cuda}")
    else:
        print(" ❌ CUDA를 인식하지 못했습니다. CPU로만 동작 중.")
except Exception as e:
    print(f" ❌ PyTorch 확인 중 오류: {e}")

print("\n" + "-" * 60)

# 2️⃣ ONNXRuntime CUDA 확인
print("[2] ONNXRuntime 확인")
try:
    providers = ort.get_available_providers()
    print(f" - 사용 가능한 프로바이더: {providers}")
    if "CUDAExecutionProvider" in providers:
        print(" ✅ CUDAExecutionProvider 사용 가능 (GPU 인식 완료)")
    else:
        print(" ⚠️ GPU 가속 비활성화됨 — CPUExecutionProvider만 사용 중")
except Exception as e:
    print(f" ❌ ONNXRuntime 확인 중 오류: {e}")

print("\n" + "-" * 60)

# 3️⃣ Faster-Whisper CUDA 확인
print("[3] Faster-Whisper 확인")
try:
    model = WhisperModel("tiny", device="cuda", compute_type="float16")
    print(" ✅ Faster-Whisper 모델 로드 성공 (CUDA 사용 중)")
    print(f" - 모델 디바이스: {model.device}")
    del model
except Exception as e:
    print(f" ❌ Faster-Whisper CUDA 로드 실패: {e}")

print("\n" + "=" * 60)
print("🔎 CUDA 테스트 완료.")
