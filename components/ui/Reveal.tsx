/**
 * Reveal — pazarlama sayfaları için scroll-reveal + stagger sarmalayıcıları.
 * Tek noktada `useReducedMotion()`: reduce ise hareket kalkar, kısa opacity kalır.
 * Yalnızca pazarlama bileşenlerinde kullanılır (Dashboard/Toast mock'larıyla çakışmaz).
 *
 * className, style, onClick, role, tabIndex, onKeyDown, aria-* ve data-testid gibi
 * standart HTML attribute'ları `...rest` ile alttaki motion elemanına iletilir.
 */
import React from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { fadeUp, reducedFade, staggerContainer, staggerItem, hoverShift } from './motionVariants';

type AsTag = 'div' | 'section' | 'article' | 'aside' | 'ul' | 'header';

interface BaseProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  children: React.ReactNode;
  as?: AsTag;
  /** whileInView tetik eşiği (0-1). */
  amount?: number;
  /** Hover/tap mikro-etkileşimi (kartlar için). */
  hover?: boolean;
  'data-testid'?: string;
}

interface RevealProps extends BaseProps {
  /** stagger DIŞI tekil bloklar için giriş gecikmesi (sn). */
  delay?: number;
  variants?: Variants;
}

/** Tek bir bloğu scroll'a girince beliren hâle getirir. */
export const Reveal: React.FC<RevealProps> = ({
  children,
  as = 'div',
  amount = 0.2,
  delay = 0,
  hover = false,
  variants,
  ...rest
}) => {
  const reduce = useReducedMotion();
  if (reduce || typeof IntersectionObserver !== 'function') {
    const Tag = as;
    return <Tag {...rest}>{children}</Tag>;
  }
  const MotionTag = motion[as] as React.ElementType;
  const base = variants ?? (reduce ? reducedFade : fadeUp);
  const hoverProps = hover && !reduce ? hoverShift : {};
  return (
    <MotionTag
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
      variants={base}
      transition={delay ? { delay } : undefined}
      {...hoverProps}
      {...rest}
    >
      {children}
    </MotionTag>
  );
};

interface GroupProps extends BaseProps {
  /** Çocuklar arası gecikme (sn). */
  stagger?: number;
  delayChildren?: number;
}

/** Çocuklarını (RevealItem) sırayla belirten parent container. */
export const RevealGroup: React.FC<GroupProps> = ({
  children,
  as = 'div',
  amount = 0.2,
  stagger = 0.08,
  delayChildren = 0,
  hover: _hover,
  ...rest
}) => {
  const reduce = useReducedMotion();
  if (reduce || typeof IntersectionObserver !== 'function') {
    const Tag = as;
    return <Tag {...rest}>{children}</Tag>;
  }
  const MotionTag = motion[as] as React.ElementType;
  return (
    <MotionTag
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
      variants={reduce ? undefined : staggerContainer(stagger, delayChildren)}
      {...rest}
    >
      {children}
    </MotionTag>
  );
};

type ItemProps = BaseProps;

/** RevealGroup içindeki tek öğe (animasyon durumunu parent'tan miras alır). */
export const RevealItem: React.FC<ItemProps> = ({
  children,
  as = 'div',
  hover = false,
  amount: _amount,
  ...rest
}) => {
  const reduce = useReducedMotion();
  if (reduce || typeof IntersectionObserver !== 'function') {
    const Tag = as;
    return <Tag {...rest}>{children}</Tag>;
  }
  const MotionTag = motion[as] as React.ElementType;
  const hoverProps = hover && !reduce ? hoverShift : {};
  return (
    <MotionTag variants={reduce ? reducedFade : staggerItem} {...hoverProps} {...rest}>
      {children}
    </MotionTag>
  );
};
