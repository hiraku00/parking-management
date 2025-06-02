declare module '@radix-ui/react-label' {
  import * as React from 'react';

  type PrimitiveLabelProps = React.ComponentPropsWithoutRef<'label'> & {
    asChild?: boolean;
  };

  export interface LabelProps extends PrimitiveLabelProps {}

  export const Root: React.ForwardRefExoticComponent<
    LabelProps & React.RefAttributes<HTMLLabelElement>
  >;
}
