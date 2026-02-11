import { useUniformRegister } from '@/hooks/useUniformRegister';

// Inside component:
const {
  entries,         // filtered list — who filled out, who paid
  summary,         // totals: paid/unpaid/partial counts + revenue
  loading,
  processing,
  filter,
  setFilter,       // change status/filledOut/searchQuery filter
  handlePrint,     // 🖨️ print the register
  handleSharePdf,  // 📤 share as PDF
  handleSendList,  // 💬 send as WhatsApp-friendly text
  handleVerifyPayment, // ✅ verify a student's payment
  onRefresh,
} = useUniformRegister(preschoolId, schoolName, showAlert);
