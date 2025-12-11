import { useI18n } from "vue-i18n";
const { t } = useI18n();
import { useRouter } from "vue-router";
import { ref, onMounted, onUnmounted, watch } from "vue";
const router = useRouter();
import { useTranslationLang } from "@/layout/hooks/useTranslationLang";
import { useServiceStoreHook } from "@/store/modules/myService";
import { languageType } from "@/utils/language-set";
import { JhTablePage } from "jh-web-components";
import { getLoginUserName, getSessionConfig } from "@/api/myService/index";
import { ElMessage } from "element-plus";
import { get } from "sortablejs";
import { getRequestExample } from "@/api/bigModelApi";
const userName = getLoginUserName();
const { translationCh, translationEn } = useTranslationLang();

if (languageType == "zh") {
  translationCh();
} else {
  translationEn();
}
defineOptions({
  name: "Welcome"
});

const props = defineProps<{
  pRow: any;
}>();

const sessionConfig = ref<any>({});
getSessionConfig().then((data: any) => {
  sessionConfig.value = data.data;
  useServiceStoreHook().SET_CONF(data.data.isEnableConfidential);
});
const SubTableRef = ref<any>();

const columns = ref([
  {
    prop: "url",
    label: "URL",
    minWidth: 200,
    columnKey: "url",
    type: "string",
    sortable: false
  },
  {
    prop: "purpose",
    label: t("apiEndpoint.create.modelPurpose"),
    minWidth: 150,
    columnKey: "purpose",
    type: "string",
    sortable: false,
    formatter: (row: any, column: any, cellValue: string) => {
      return t(`models.detail.${row.purpose}`);
    }
  },
  {
    prop: "models",
    label: t("apiEndpoint.detail.modelName"),
    minWidth: 200,
    columnKey: "models",
    type: "string",
    sortable: false
  },
  {
    prop: "demo",
    label: t("myService.detail.RequestExample"),
    minWidth: 150,
    slot: {
      default: "demoSlot"
    },
    type: "string",
    sortable: false
  }
] as any);
const tableData = ref([]);
const tableTotal = ref();
watch(
  () => props.pRow,
  val => {
    if (!val || !Object.keys(val).length) return;

    const mappings = val.apiEndpointModelMappings || [];
    const services = val.apiEndpointModelServices || [];

    // 1. 构建 target → source 映射（目标：本名 -> 别名）
    const targetToSource = new Map<string, Set<string>>();
    mappings.forEach((m: any) => {
      if (!targetToSource.has(m.targetModel)) {
        targetToSource.set(m.targetModel, new Set());
      }
      targetToSource.get(m.targetModel)!.add(m.sourceModel);
    });

    // 2. 替换模型名：只要有映射，就强制用别名
    const finalServices = services.flatMap((item: any) => {
      const modelName = item.modelName;

      if (targetToSource.has(modelName)) {
        // 有多个别名 → 展示所有别名
        return [...targetToSource.get(modelName)!].map(alias => ({
          ...item,
          modelName: alias
        }));
      }

      // 无别名 → 展示本名
      return [{ ...item }];
    });

    // 3. 按 purpose 分组 + 去重
    const grouped: Record<string, Set<string>> = {};
    finalServices.forEach(item => {
      const purpose = item.modelPurpose;
      const name = item.modelName;

      if (!grouped[purpose]) grouped[purpose] = new Set();
      grouped[purpose].add(name);
    });

    // 4. 输出 tableData
    const order = ["llm", "images", "embeddings", "rerank", "tts", "stt"];
    const purposeUrlMap = {
      llm: "/chat/completions",
      images: "/images/generations",
      embedding: "/embeddings",
      rerank: "/rerank",
      tts: "/audio/speech",
      stt: "/audio/transcriptions"
    };

    tableData.value = Object.entries(grouped)
      .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
      .map(([purpose, namesSet]) => ({
        url: `${window.location.origin}${val.prefix}${purposeUrlMap[purpose]}`,
        purpose,
        models: [...namesSet].join(", ")
      }));
  },
  { immediate: true, deep: true }
);

const elTableAttrs = ref({
  rowKey: "id",
  rowClassName: "tableRowClassName"
});



const RequestExampleDialog = ref(false);
const RequestExampleData = ref([] as any);
const RequestExampleValue = ref("");
const RequestExampleCode = ref("");

async function RequestExample(row) {
  if (!row || !row.purpose) {
    console.warn("Invalid row or missing purpose");
    return;
  }

  const { id } = props.pRow;
  if (!id) {
    console.warn("Missing pRow.id");
    return;
  }
  try {
    const res = await getRequestExample(id, row.purpose);

    if (res?.isSuccess && Array.isArray(res.data?.[row.purpose])) {
      RequestExampleData.value = res.data[row.purpose];
    } else {
      RequestExampleData.value = [];
      console.debug(`No valid data for purpose: ${row.purpose}`);
    }

    const dataList = RequestExampleData.value;
    if (dataList.length > 0) {
      const language = dataList[0].language;
      RequestExampleValue.value = language;
      RequestExampleCurrentRow.value = row;
      setRequestExampleCode(language, row);
    }

    RequestExampleDialog.value = true;
  } catch (error) {
    console.error("Failed to fetch request example:", error);
    RequestExampleData.value = [];
    RequestExampleDialog.value = false; // 可选：请求失败是否弹窗
  }
}

const RequestExampleCurrentRow = ref(null);

const setRequestExampleCode = (value, row) => {
  const data = RequestExampleData.value.find(el => el.language === value);
  if (data) {
    const firstModel = row?.models ? row.models.split(",")[0].trim() : "";

    let content = data.content
      .replaceAll("${BASE_URL}", window.location.origin)
      .replaceAll("${MODEL}", firstModel);

    const language = value.toLowerCase();
    RequestExampleCode.value = `\`\`\`${language}
${content}
\`\`\``;
  }
};

const RequestExamplehandle = (language: string) => {
  setRequestExampleCode(language, RequestExampleCurrentRow.value);
};

const RequestExampleContentCopy = (code: any) => {
  ElMessage({
    message: t("common.modal.copySuccess"),
    type: "success"
  });
};

const 

  procedure
  specify



