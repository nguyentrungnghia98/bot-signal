import React, { FC }  from "react";
import './style.css';

interface Props {
  value: string;
  label: string;
  name?: string;
  placeholder?: string;
  type?: string;
  onChange: (value: string) => void;
}

const Input: FC<Props> = ({ value, label, name, placeholder, type, onChange }) => (
  <div className="form-group">
    {label && <label htmlFor="input-field">{label}</label>}
    <input
      type={type}
      value={value}
      name={name}
      className="form-control"
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
    />
  </div>
);

export default Input;