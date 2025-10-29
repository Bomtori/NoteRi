import { useSearchParams } from "react-router-dom";

export default function PaymentFail() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");
  const message = searchParams.get("message");

  return (
    <div>
      <h1>❌ 결제 실패</h1>
      <p>에러 코드: {code}</p>
      <p>메시지: {message}</p>
    </div>
  );
}