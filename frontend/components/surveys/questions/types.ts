import { SurveyQuestionType } from "@/types/survey";
import { SurveyAnswer } from "@/hooks/api/useSurveys";

export interface QuestionProps {
  question: {
    id: string;
    type: SurveyQuestionType;
    text: string;
    isRequired: boolean;
    options: { id: string; text: string; order: number }[];
    choiceConfig?: { allowOther: boolean; allowMultiple: boolean } | null;
    scaleConfig?: { scaleMin: number; scaleMax: number; step: number } | null;
  };
  answer: SurveyAnswer | undefined;
  onChange: (answer: SurveyAnswer) => void;
}
