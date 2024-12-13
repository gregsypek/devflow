import React, { ReactNode } from "react";

import Navbar from "@/components/navbar";

const RootLayout = ({ children }: { children: ReactNode }) => {
  return (
    <main>
      <Navbar />
      {children}
    </main>
  );
};

export default RootLayout;
