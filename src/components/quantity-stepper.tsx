import { Box, Button, Text } from "zmp-ui";

/** Bộ tăng/giảm số lượng. Chặn vượt tồn kho ngay tại chỗ để khách biết sớm. */
export const QuantityStepper = ({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (next: number) => void;
}) => (
  <Box flex alignItems="center" className="gap-2">
    <Button
      size="small"
      variant="secondary"
      disabled={value <= 1}
      onClick={() => onChange(value - 1)}
      aria-label="Giảm số lượng"
    >
      −
    </Button>
    <Text className="w-8 text-center">{value}</Text>
    <Button
      size="small"
      variant="secondary"
      disabled={max > 0 && value >= max}
      onClick={() => onChange(value + 1)}
      aria-label="Tăng số lượng"
    >
      +
    </Button>
  </Box>
);
