import { BrowserRouter, Routes, Route } from "react-router-dom";
import PaymentButton from "./PaymentButton";
import PaymentSuccess from "./PaymentSuccess";
import PaymentFail from "./PaymentFail";
import ChatBox from "./test/ChatBox";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/test" element={<ChatBox/> } />
        <Route path="/" element={<PaymentButton />} />
        <Route path="/payments/success" element={<PaymentSuccess />} />
        <Route path="/payments/fail" element={<PaymentFail />} /><ChatBox />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
