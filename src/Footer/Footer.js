import React, { useState } from "react";
import Credits from "./Credits";

const Footer = ({theme}) => {
  const [credit, setCredit] = useState(false);
  const toggleCredit = () => {
    setCredit(!credit);
  };
  return (
    <div className={`footer ${theme}_bg_secondary`}>
      <div className={"footer__item"}>Joseph Cake</div>
      <div className={"footer__item"}>
        <a
          rel="noopener noreferrer"
          target={"_blank"}
          className={"link-tag linkedin"}
          href={"https://www.linkedin.com/in/jocake"}
        >
          Linkedin
        </a>
      </div>
      <div className={"footer__item"}>
        <a
          rel="noopener noreferrer"
          target={"_blank"}
          className={"link-tag github"}
          href={"https://www.github.com/josephcake"}
        >
          Github
        </a>
      </div>
      <div onClick={() => setCredit(true)} className={"footer__item"}>
        Credits
      </div>
      {credit && <Credits setCredit={toggleCredit} />}
    </div>
  );
};
export default Footer;
