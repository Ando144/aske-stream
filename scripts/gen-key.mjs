#!/usr/bin/env node
// Prints a new random access key (32 bytes, base64url). Use it as ACCESS_KEY.
import { randomBytes } from 'node:crypto';

console.log(randomBytes(32).toString('base64url'));
