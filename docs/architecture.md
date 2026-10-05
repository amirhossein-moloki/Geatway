# Payment Architecture Specification

## Overview

The architecture is designed to enforce complete decoupling between core payment logic and payment providers.

## Key Rules

1. Core has zero provider-specific identifiers.
2. Core is database-agnostic and framework-agnostic.
3. Gateways explicitly state capabilities using `GatewayCapability`.
