import React from "react";

type StepStatus = "completed" | "current" | "upcoming";

interface ProgressIndicatorProps {
  currentStep: number;
  className?: string;
}

const steps = [
  { number: 1, title: "Absensi", subtitle: "" },
  { number: 2, title: "Lampiran", subtitle: "" },
  { number: 3, title: "Review", subtitle: "" },
];

const getStepStatus = (currentStep: number, stepNumber: number): StepStatus => {
  if (currentStep > stepNumber) return "completed";
  if (currentStep === stepNumber) return "current";
  return "upcoming";
};

const statusStyles: Record<StepStatus, { circle: string; label: string }> = {
  completed: {
    circle:
      "border-[#0a5d57] bg-[#0a5d57] text-white shadow-[0_8px_16px_rgba(10,93,87,0.24)]",
    label: "text-[#0a5d57]",
  },
  current: {
    circle:
      "border-[#0a5d57] bg-transparant text-[#0a5d57] shadow-[0_8px_20px_rgba(10,93,87,0.22)]",
    label: "text-[#0a5d57]",
  },
  upcoming: {
    circle: "border-[#CFE7E1] bg-transparant text-[#9CA3AF]",
    label: "text-[#9CA3AF]",
  },
};

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  currentStep,
  className = "",
}) => {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center gap-2 md:gap-6 justify-between">
        {steps.map((step, index) => {
          const status = getStepStatus(currentStep, step.number);
          const isLast = index === steps.length - 1;

          return (
            <React.Fragment key={step.number}>
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={`w-12 h-12 md:w-14 md:h-14 rounded-full border-4 flex items-center justify-center text-sm md:text-base font-bold transition-all duration-300 ${statusStyles[status].circle}`}
                >
                  {step.number}
                </div>
                <div
                  className={`mt-3 text-center transition-colors duration-300 ${statusStyles[status].label}`}
                >
                  <p className="text-xs md:text-sm font-semibold leading-tight">
                    {step.title}
                  </p>
                </div>
              </div>
              {!isLast && (
                <div className="flex-1 flex items-center relative min-w-[24px] md:min-w-[48px]">
                  <span
                    className={`h-1 w-full rounded-full transition-all duration-300 absolute left-0 -mt-5 -translate-y-1/2`}
                    style={{
                      background:
                        currentStep > step.number
                          ? "#fdd60f"
                          : currentStep === step.number
                            ? "linear-gradient(90deg, #fdd60f 0%, #cfe7e1 50%)"
                            : "#cfe7e1",
                    }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default ProgressIndicator;
