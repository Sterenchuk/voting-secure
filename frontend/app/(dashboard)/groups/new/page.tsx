import { Suspense } from "react";
import CreateGroupForm from "./CreateGroupForm";

export default function CreateGroupPage() {
  return (
    <Suspense fallback={<div />}>
      <CreateGroupForm />
    </Suspense>
  );
}
