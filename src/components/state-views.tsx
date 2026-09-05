import { Box, Button, Spinner, Text } from "zmp-ui";

export const Loading = ({ label = "Đang tải" }: { label?: string }) => (
  <Box flex justifyContent="center" alignItems="center" className="py-10">
    <Spinner />
    <Text className="ml-2 text-sm" style={{ color: "var(--mnp-muted)" }}>
      {label}
    </Text>
  </Box>
);

/** Trạng thái rỗng là một lời mời hành động, không phải một lời xin lỗi. */
export const Empty = ({
  title,
  hint,
  actionLabel,
  onAction,
}: {
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
}) => (
  <Box className="px-6 py-12 text-center">
    <Text.Title size="normal">{title}</Text.Title>
    {hint && (
      <Text className="mt-1 text-sm" style={{ color: "var(--mnp-muted)" }}>
        {hint}
      </Text>
    )}
    {actionLabel && onAction && (
      <Button className="mt-4" size="medium" onClick={onAction}>
        {actionLabel}
      </Button>
    )}
  </Box>
);

/** Lỗi nói rõ chuyện gì xảy ra và cách sửa, không chỉ "Đã có lỗi". */
export const ErrorView = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) => (
  <Box className="px-6 py-12 text-center">
    <Text.Title size="normal">Không tải được dữ liệu</Text.Title>
    <Text className="mt-1 text-sm" style={{ color: "var(--mnp-muted)" }}>
      {message}
    </Text>
    {onRetry && (
      <Button className="mt-4" size="medium" onClick={onRetry}>
        Thử lại
      </Button>
    )}
  </Box>
);
