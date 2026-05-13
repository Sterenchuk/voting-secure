import { Suspense } from "react";
import CreateSurveyForm from "./CreateSurveyForm";

export default function CreateSurveyPage() {
  return (
    <Suspense fallback={<div />}>
      <CreateSurveyForm />
    </Suspense>
  );
}
