import React, { useMemo } from "react";
import { useSelector } from "react-redux";
import UserTabs from "../Navigation/userTab";

export default function U_ButtonNav({ initialRouteName = "Home" }) {
  const authState = useSelector((s) => s.auth);

  // ✅ รองรับได้ทั้งกรณี auth.uid หรือ auth.user
  const userId = useMemo(
    () => authState?.uid ?? authState?.user ?? "",
    [authState?.uid, authState?.user]
  );

  // ✅ ส่ง userId เข้าไปใน UserTabs (จะนำไปใช้ภายใน Tab ต่างๆ ต่อได้)
  return (
    <UserTabs
      initialRouteName={String(initialRouteName || "Home")}
      userId={String(userId || "")}
    />
  );
}
