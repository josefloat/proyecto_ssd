---
name: Señal de Vida
colors:
  surface: '#f5fafe'
  surface-dim: '#d5dbdf'
  surface-bright: '#f5fafe'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4f8'
  surface-container: '#e9eef2'
  surface-container-high: '#e4e9ed'
  surface-container-highest: '#dee3e7'
  on-surface: '#171c1f'
  on-surface-variant: '#424752'
  inverse-surface: '#2c3134'
  inverse-on-surface: '#ecf1f5'
  outline: '#727783'
  outline-variant: '#c2c6d4'
  surface-tint: '#005db7'
  primary: '#004d99'
  on-primary: '#ffffff'
  primary-container: '#1565c0'
  on-primary-container: '#dae5ff'
  inverse-primary: '#a9c7ff'
  secondary: '#006a62'
  on-secondary: '#ffffff'
  secondary-container: '#81f3e5'
  on-secondary-container: '#006f66'
  tertiary: '#36506e'
  on-tertiary: '#ffffff'
  tertiary-container: '#4e6888'
  on-tertiary-container: '#d6e6ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d6e3ff'
  primary-fixed-dim: '#a9c7ff'
  on-primary-fixed: '#001b3d'
  on-primary-fixed-variant: '#00468c'
  secondary-fixed: '#84f5e8'
  secondary-fixed-dim: '#66d9cc'
  on-secondary-fixed: '#00201d'
  on-secondary-fixed-variant: '#005049'
  tertiary-fixed: '#d2e4ff'
  tertiary-fixed-dim: '#aec9ed'
  on-tertiary-fixed: '#001d37'
  on-tertiary-fixed-variant: '#2e4867'
  background: '#f5fafe'
  on-background: '#171c1f'
  surface-variant: '#dee3e7'
typography:
  display-code:
    fontFamily: JetBrains Mono
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: 0.05em
  headline-lg:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-md:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  body-lg:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 20px
    fontWeight: '400'
    lineHeight: 30px
  body-md:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  label-lg:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 24px
  label-md:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 16px
    fontWeight: '700'
    lineHeight: 20px
    letterSpacing: 0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  margin-mobile: 20px
  gutter-mobile: 16px
  touch-target-min: 48px
  button-height: 64px
  stack-gap: 24px
---

## Brand & Style
The brand personality is profoundly human, trustworthy, and inclusive. Designed specifically for the Peruvian healthcare context, the design system prioritizes clarity and warmth to reduce patient anxiety during the booking process. 

The aesthetic follows a **Modern Healthcare** approach with a focus on high accessibility. It combines soft, rounded forms with high-contrast functional elements to ensure users of all ages and visual abilities can navigate the interface with confidence. The style is "Mobile-First," emphasizing a "one-task-per-screen" philosophy to minimize cognitive load.

## Colors
The palette is anchored by a high-contrast Medical Blue for primary actions and a Dark Navy for maximum text legibility. 

The Page Background uses a soft tint to reduce screen glare, while the Surface Background (pure white) is reserved for interactive cards and containers. A specific suite of Specialty Pastels is utilized to categorize medical departments, providing a visual shorthand that aids in quick recognition without overwhelming the user with saturated colors.

## Typography
We utilize Atkinson Hyperlegible Next to ensure every character is distinct, which is critical for medical information and patient data. 

To maintain high accessibility, the minimum body size is set to 18px. Headlines are bold and prominent to anchor the user's focus. For Reservation Codes, a monospaced font is used to prevent character confusion (e.g., distinguishing 'I' from '1'), ensuring patients can accurately transcribe their booking information.

## Layout & Spacing
The layout uses a fluid, single-column model for mobile devices, ensuring large, tappable targets across the entire screen width. 

A vertical "stacking" rhythm of 24px is maintained between major sections to prevent visual clutter. All interactive elements have a minimum touch target of 48px, though primary buttons are oversized at 64px to accommodate users with limited dexterity or those navigating while on the move. Generous side margins of 20px keep content safe from screen edges.

## Elevation & Depth
Depth is created through **Tonal Layers** rather than heavy shadows. The background is a soft blue-grey, while active content "pops" on white cards with a very soft, diffused ambient shadow (4% opacity Navy tint). 

Interactive cards utilize a subtle 1px border in a slightly darker neutral shade to define boundaries clearly without creating visual noise. This approach ensures that even in low-light conditions or on lower-quality screens, the hierarchy of information remains unmistakable.

## Shapes
The shape language is defined by friendliness. Large, generous radii are applied to all primary containers (18px-22px) to evoke a sense of care and approachability. 

Icons are housed in "squircle" or rounded-square containers using the specialty pastel palette. Buttons follow a consistent 16px radius, creating a cohesive visual thread between input fields and action triggers.

## Components

### Buttons
Primary buttons are 64px high, utilizing the Main Medical Blue with white text. They should span the full width of the content area on mobile to be easily reachable by either thumb.

### Progress Bar
A simple 5-segment indicator sits at the top of the booking flow. Active segments are Medical Blue, while inactive segments are a pale grey-blue. This provides a clear "light at the end of the tunnel" for the booking process.

### Cards & Category Icons
Medical specialties (e.g., Pediatría, Cardiología) are presented in large cards. Each card features a high-contrast icon placed inside a pastel-colored rounded square. These cards should have ample internal padding (24px) to keep text away from the edges.

### Form Inputs
Input fields must have a 20px bold label placed above the field. The input box itself should be 56px high with a 16px radius and a clear focus state using the Medical Blue border.

### Back Action
The "← Volver" action is always positioned at the top-left. It combines a bold arrow with clear text to ensure the "undo" path is always visible and understandable.

### Illustrations
Use soft-edged, clean illustrations representing Peruvian healthcare professionals. Characters should have friendly expressions and be integrated naturally into the background or at the end of successful flows to reinforce a positive emotional state.