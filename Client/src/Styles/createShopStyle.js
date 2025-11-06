
import { StyleSheet, Platform } from "react-native";

const radius = 14;

export const styles = StyleSheet.create({
  /* ---------- layout ---------- */
  container: {
    padding: 20,
    paddingBottom: 28,
    gap: 14,
  },

  /* ---------- headings ---------- */
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 12,
  },

  /* ---------- card ---------- */
  card: {
    backgroundColor: "#ffffff",
    borderRadius: radius,
    padding: 14,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 2 },
      default: {},
    }),
  },

  /* ---------- form ---------- */
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111827",
  },
  textarea: {
    minHeight: 90,
    textAlignVertical: "top",
  },

  /* ---------- select (modal dropdown) ---------- */
  selectInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: "center",
  },
  selectText: {
    fontSize: 15,
    color: "#111827",
  },
  selectPlaceholder: {
    fontSize: 15,
    color: "#9ca3af",
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: "70%",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 10,
  },
  optionRow: {
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  optionText: {
    fontSize: 15,
    color: "#111827",
    flex: 1,
    paddingRight: 8,
  },
  optionTick: {
    fontSize: 16,
    color: "#10b981",
    marginLeft: 8,
  },

  /* ---------- image ---------- */
  preview: {
    width: "100%",
    height: 180,
    borderRadius: 14,
    marginBottom: 10,
  },
  previewPlaceholder: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f9fafb",
  },
  muted: {
    color: "#9ca3af",
    fontSize: 13,
  },

  /* ---------- buttons ---------- */
  button: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  primary: {
    backgroundColor: "#2563eb",
  },
  ghost: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  ghostText: {
    color: "#111827",
  },

  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },

  /* ---------- map ---------- */
  map: {
    width: "100%",
    height: 220,
    borderRadius: 14,
    overflow: "hidden",
  },
  coordsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  coords: {
    fontSize: 12,
    color: "#6b7280",
  },

  /* ---------- search ---------- */
  searchWrap: {
    position: "relative",
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111827",
  },
  searchDropdown: {
    position: "absolute",
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 3 },
      default: {},
    }),
    maxHeight: 220,
    zIndex: 50,
  },
  searchItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchText: {
    fontSize: 14,
    color: "#111827",
  },
  searchSep: {
    height: 1,
    backgroundColor: "#f3f4f6",
    marginHorizontal: 12,
  },
});
