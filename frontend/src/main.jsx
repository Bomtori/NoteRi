import "./styles/globals.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "./app/store";
import App from "./App";


ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <Provider store={store}>
            <App />
        </Provider>
    </React.StrictMode>
);

// 범철님 프론트
// <React.StrictMode>
  //   <BrowserRouter>
  //     <Routes>
  //       {/* 기본 경로를 /meeting 으로 리다이렉트 */}
  //       <Route path="/" element={<Navigate to="/meeting" replace />} />
  //       <Route path="/meeting" element={<MeetingPage />} />
  //       <Route path="/pay" element={<PaymentButton />} />
  //       <Route path="/pay/success" element={<PaymentSuccess />} />
  //       <Route path="/pay/fail" element={<PaymentFail />} />
  //       {/* 나중에 App 안쪽 페이지들을 여기에 추가할 수도 있음 */}
  //     </Routes>
  //   </BrowserRouter>
  // </React.StrictMode>
