import { BrowserRouter, Routes, Route } from "react-router-dom";
import PaymentButton from "./PaymentButton";
import PaymentSuccess from "./PaymentSuccess";
import PaymentFail from "./PaymentFail";
import ChatBox from "./test/ChatBox";
import LoginPage from "./test/LoginPage.jsx";
import AuthCallback from "./test/AuthCallback.jsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/test" element={<LoginPage/> } />
          <Route path="/test/auth/callback" element={<AuthCallback/>}/>
          <Route path="/test/chat" element={<ChatBox/>}/>
          <Route path="/test/login" element={<LoginPage/>}/>
        <Route path="/" element={<PaymentButton />} />
        <Route path="/payments/success" element={<PaymentSuccess />} />
        <Route path="/payments/fail" element={<PaymentFail />} /><ChatBox />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
