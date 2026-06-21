import { Suspense } from "react";
import CreateVotingForm from "./CreateVotingForm";

export default function CreateVotingPage() {
  return (
    <Suspense fallback={<div />}>
      <CreateVotingForm />
    </Suspense>
  );
}
