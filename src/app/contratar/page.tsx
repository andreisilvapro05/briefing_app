import { Suspense } from "react";
import { ContratarWizard } from "./client";

export default function ContratarPage() {
  return (
    <Suspense>
      <ContratarWizard />
    </Suspense>
  );
}
