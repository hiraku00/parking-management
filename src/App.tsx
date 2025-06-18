import "./App.css";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import OwnerDashboard from "./pages/OwnerDashboard";
import ContractorDashboard from "./pages/ContractorDashboard";
import ContractorDetail from "./pages/ContractorDetail";
import ContractorPage from "./pages/ContractorPage";
import PaymentSuccess from "./pages/PaymentSuccess";

function App() {
  return (
    <div className="w-full min-h-screen">
      <Router>
        <Routes>
          <Route path="/" element={<OwnerDashboard />} />
          <Route path="/contractor" element={<ContractorDashboard />} />
          <Route path="/contractor/:name" element={<ContractorDetail />} />
          <Route
            path="/contractor/:name/payment"
            element={<ContractorPage />}
          />
          <Route
            path="/contractor/:name/payment/success"
            element={<PaymentSuccess />}
          />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
