import { useEffect } from "react";
import { openWebview } from "zmp-sdk/apis";

export default function HomePage() {
  useEffect(() => {
    openWebview({
      url: "https://minpharmacy.com.vn/app",
      config: {
        style: "normal",
      },
    });
  }, []);

  return null;
}