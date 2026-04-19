"use client";
import dynamic from "next/dynamic";

const App = dynamic(() => import("./_app"), { ssr: false });

export default function Page() {
  return <App />;
}
