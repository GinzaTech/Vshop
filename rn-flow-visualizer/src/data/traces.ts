import { addToCartTrace } from './addToCartTrace';
import { fetchProfileTrace } from './fetchProfileTrace';
import { genericButtonTrace } from './genericButtonTrace';
import { loginFailedTrace } from './loginFailedTrace';
import { loginSuccessTrace } from './loginSuccessTrace';

export const traces = [
  loginSuccessTrace,
  loginFailedTrace,
  genericButtonTrace,
  fetchProfileTrace,
  addToCartTrace,
];
