"use client";

import { AppType } from "@/db/constants";
import TwitterForm from "@/components/TwitterForm";
import CapitalOneForm from "@/components/CapitalOneForm";
import MercuryForm from "@/components/MercuryForm";
import SlackForm from "@/components/SlackForm";
import RoamResearchForm from "@/components/RoamResearchForm";
import GoogleForm from "@/components/GoogleForm";
import TwilioForm from "@/components/TwilioForm";
import DefaultApplicationForm from "@/components/DefaultApplicationForm";

interface ApplicationFormRendererProps {
  appType: AppType | null | "";
  applicationId?: string;
}

export default function ApplicationFormRenderer({
  appType,
  applicationId,
}: ApplicationFormRendererProps) {
  switch (appType) {
    case "TWITTER":
      return <TwitterForm />;
    case "CAPITAL_ONE":
      return <CapitalOneForm applicationId={applicationId} />;
    case "MERCURY":
      return <MercuryForm />;
    case "SLACK":
      return <SlackForm />;
    case "ROAM_RESEARCH":
      return <RoamResearchForm />;
    case "GOOGLE":
      return <GoogleForm />;
    case "TWILIO":
      return <TwilioForm />;
    case "NOTION":
    case "DEVIN":
    case "RECALL":
    default:
      return appType ? <DefaultApplicationForm /> : null;
  }
}
