import React from "react";
import { Toaster as HotToaster } from "react-hot-toast";

export const Toaster: React.FC = () => (
  <HotToaster
    position="top-right"
    toastOptions={{
      style: {
        background: "rgba(15, 23, 42, 0.9)",
        color: "#f8fafc",
        borderRadius: "12px",
        border: "1px solid rgba(148, 163, 184, 0.2)",
        padding: "12px 16px"
      }
    }}
  />
);
