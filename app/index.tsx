import LoadingScreen from "~/components/LoadingScreen";

/**
 * Index — Route loading tạm thời khi JS bundle khởi động.
 * Giữ giao diện giống hệt overlay bootstrap để app không nháy giữa
 * hai màn hình loading khác nhau trong lúc khởi tạo.
 *
 * @returns {JSX.Element} LoadingScreen với message cố định.
 */
function Index() {
  return <LoadingScreen message="Loading data..." />;
}

export default Index;
