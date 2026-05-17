import { Composition } from "remotion";
import { PiNotesPreview } from "./PiNotesPreview";

export const RemotionRoot = () => {
  return (
    <Composition
      id="PiNotesPreview"
      component={PiNotesPreview}
      durationInFrames={150}
      fps={30}
      width={1600}
      height={900}
    />
  );
};
