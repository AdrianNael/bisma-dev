import React, { useState } from "react";

function PopUp() {
  const [showPopUp, _Pop] = useState(true);

  return (
    <div className="z-40 w-full h-full bg-black">
      {showPopUp ? (
        <div className="z-40 w-full h-full bg-black">PopUp!</div>
      ) : null}
    </div>
  );
}

export default PopUp;
