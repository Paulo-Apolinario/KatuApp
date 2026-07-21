import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useAuth } from "@/src/contexts/AuthContext";
import { useNotification } from "@/src/contexts/NotificationContext";
import { scheduleService } from "@/src/services/scheduleService";
import { wasteCatalogService } from "@/src/services/wasteCatalogService";

import type {
  ScheduleMaterialDraft,
} from "@/src/types/schedule";

import type {
  WasteCatalogItem,
  WasteUnit,
} from "@/src/types/collection";

/*
 * ============================================================
 * TIPOS LOCAIS
 * ============================================================
 */

type AuthUserLike = {
  id?: string;
  role?: string;
  generator?: {
    id?: string;
    cooperativeId?: string;
  } | null;
};

type ProposedMaterialForm = {
  name: string;
  category: string;
  subcategory: string;
  unit: WasteUnit;
  estimatedQuantity: string;
};

const WASTE_UNITS: {
  value: WasteUnit;
  label: string;
}[] = [
  { value: "KG", label: "kg" },
  { value: "TON", label: "t" },
  { value: "LITER", label: "L" },
  { value: "UNIT", label: "un" },
  { value: "CUBIC_METER", label: "m³" },
];

/*
 * ============================================================
 * FUNÇÕES AUXILIARES
 * ============================================================
 */

function createLocalId() {
  return `material_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

function normalizeDecimalInput(value: string) {
  const cleaned = value
    .replace(",", ".")
    .replace(/[^0-9.]/g, "");

  const [integerPart, ...decimalParts] =
    cleaned.split(".");

  if (decimalParts.length === 0) {
    return integerPart;
  }

  return `${integerPart}.${decimalParts.join("")}`;
}

function parsePositiveNumber(value: string) {
  const normalized = value
    .trim()
    .replace(",", ".");

  if (!normalized) {
    return undefined;
  }

  const number = Number(normalized);

  if (!Number.isFinite(number) || number <= 0) {
    return undefined;
  }

  return number;
}

function formatDateInput(value: string) {
  const digits = value
    .replace(/\D/g, "")
    .slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(
    2,
    4
  )}/${digits.slice(4)}`;
}

function formatTimeInput(value: string) {
  const digits = value
    .replace(/\D/g, "")
    .slice(0, 4);

  if (digits.length <= 2) {
    return digits;
  }

  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function parseDateTimeToIso(
  dateValue: string,
  timeValue: string
): string | null {
  if (
    !/^\d{2}\/\d{2}\/\d{4}$/.test(dateValue) ||
    !/^\d{2}:\d{2}$/.test(timeValue)
  ) {
    return null;
  }

  const [day, month, year] =
    dateValue.split("/").map(Number);

  const [hour, minute] =
    timeValue.split(":").map(Number);

  const parsed = new Date(
    year,
    month - 1,
    day,
    hour,
    minute,
    0,
    0
  );

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hour ||
    parsed.getMinutes() !== minute
  ) {
    return null;
  }

  return parsed.toISOString();
}

function getUnitLabel(unit: WasteUnit) {
  return (
    WASTE_UNITS.find(
      (item) => item.value === unit
    )?.label || unit
  );
}

function getCatalogItemUnit(
  item: WasteCatalogItem
): WasteUnit {
  return (
    item.unit ||
    item.defaultUnit ||
    "KG"
  );
}

/*
 * ============================================================
 * TELA
 * ============================================================
 */

export default function GeneratorScheduleScreen() {
  const { user } = useAuth();

  const currentUser =
    user as AuthUserLike | null;

  const {
    notifyError,
    notifySuccess,
    notifyWarning,
  } = useNotification();

  const [catalogLoading, setCatalogLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [catalogItems, setCatalogItems] =
    useState<WasteCatalogItem[]>([]);

  const [catalogError, setCatalogError] =
    useState<string | null>(null);

  const [searchTerm, setSearchTerm] =
    useState("");

  const [selectedDate, setSelectedDate] =
    useState("");

  const [selectedTime, setSelectedTime] =
    useState("");

  const [notes, setNotes] =
    useState("");

  const [materials, setMaterials] =
    useState<ScheduleMaterialDraft[]>([]);

  const [showNewMaterialForm, setShowNewMaterialForm] =
    useState(false);

  const [proposedForm, setProposedForm] =
    useState<ProposedMaterialForm>({
      name: "",
      category: "",
      subcategory: "",
      unit: "KG",
      estimatedQuantity: "",
    });

  const loadCatalog = useCallback(async () => {
    try {
      setCatalogLoading(true);
      setCatalogError(null);

      const items =
        await wasteCatalogService.list();

      setCatalogItems(
        Array.isArray(items)
          ? items
          : []
      );
    } catch (error) {
      const message =
        error instanceof Error &&
        error.message.trim()
          ? error.message
          : "Não foi possível carregar o catálogo de resíduos.";

      setCatalogItems([]);
      setCatalogError(message);
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const filteredCatalogItems = useMemo(() => {
    const normalizedTerm = searchTerm
      .trim()
      .toLocaleLowerCase("pt-BR");

    if (!normalizedTerm) {
      return catalogItems;
    }

    return catalogItems.filter((item) => {
      const searchable = [
        item.name,
        item.category,
        item.subcategory,
        item.internalCode,
        item.ncm,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR");

      return searchable.includes(
        normalizedTerm
      );
    });
  }, [catalogItems, searchTerm]);

  function isCatalogItemSelected(id: string) {
    return materials.some(
      (material) =>
        material.source === "CATALOG" &&
        material.wasteTypeId === id
    );
  }

  function addCatalogItem(
    item: WasteCatalogItem
  ) {
    if (isCatalogItemSelected(item.id)) {
      notifyWarning(
        "Este material já foi adicionado."
      );
      return;
    }

    const unit =
      getCatalogItemUnit(item);

    setMaterials((current) => [
      ...current,
      {
        localId: createLocalId(),
        wasteTypeId: item.id,
        name: item.name,
        category: item.category,
        subcategory: item.subcategory,
        estimatedQuantity: undefined,
        unit,
        source: "CATALOG",
      },
    ]);
  }

  function removeMaterial(localId: string) {
    setMaterials((current) =>
      current.filter(
        (material) =>
          material.localId !== localId
      )
    );
  }

  function updateMaterialQuantity(
    localId: string,
    value: string
  ) {
    const normalizedInput =
      normalizeDecimalInput(value);

    const quantity =
      normalizedInput === ""
        ? undefined
        : Number(normalizedInput);

    setMaterials((current) =>
      current.map((material) =>
        material.localId === localId
          ? {
              ...material,
              estimatedQuantity:
                Number.isFinite(quantity)
                  ? quantity
                  : undefined,
            }
          : material
      )
    );
  }

  function updateMaterialUnit(
    localId: string,
    unit: WasteUnit
  ) {
    setMaterials((current) =>
      current.map((material) =>
        material.localId === localId
          ? {
              ...material,
              unit,
              proposedMaterial:
                material.proposedMaterial
                  ? {
                      ...material.proposedMaterial,
                      unit,
                    }
                  : undefined,
            }
          : material
      )
    );
  }

  function resetProposedForm() {
    setProposedForm({
      name: "",
      category: "",
      subcategory: "",
      unit: "KG",
      estimatedQuantity: "",
    });

    setShowNewMaterialForm(false);
  }

  function addProposedMaterial() {
    const name =
      proposedForm.name.trim();

    if (name.length < 2) {
      notifyWarning(
        "Informe o nome do novo material."
      );
      return;
    }

    const duplicate = materials.some(
      (material) =>
        material.source === "PROPOSED" &&
        material.name
          .trim()
          .toLocaleLowerCase("pt-BR") ===
          name.toLocaleLowerCase("pt-BR") &&
        material.unit === proposedForm.unit
    );

    if (duplicate) {
      notifyWarning(
        "Este material já foi adicionado."
      );
      return;
    }

    const estimatedQuantity =
      parsePositiveNumber(
        proposedForm.estimatedQuantity
      );

    setMaterials((current) => [
      ...current,
      {
        localId: createLocalId(),
        proposedMaterial: {
          name,
          category:
            proposedForm.category.trim() ||
            undefined,
          subcategory:
            proposedForm.subcategory.trim() ||
            undefined,
          unit: proposedForm.unit,
        },
        name,
        category:
          proposedForm.category.trim() ||
          undefined,
        subcategory:
          proposedForm.subcategory.trim() ||
          undefined,
        estimatedQuantity,
        unit: proposedForm.unit,
        source: "PROPOSED",
      },
    ]);

    resetProposedForm();
  }

  async function handleSchedule() {
    const cooperativeId =
      currentUser?.generator
        ?.cooperativeId;

    if (!currentUser?.id) {
      notifyError(
        "Usuário não autenticado."
      );
      return;
    }

    if (!cooperativeId) {
      notifyError(
        "Cooperativa do gerador não encontrada."
      );
      return;
    }

    if (
      !selectedDate ||
      !selectedTime
    ) {
      notifyWarning(
        "Informe a data e o horário preferencial."
      );
      return;
    }

    const preferredDate =
      parseDateTimeToIso(
        selectedDate,
        selectedTime
      );

    if (!preferredDate) {
      notifyWarning(
        "Informe uma data e um horário válidos."
      );
      return;
    }

    if (
      new Date(preferredDate).getTime() <=
      Date.now()
    ) {
      notifyWarning(
        "A data preferencial precisa estar no futuro."
      );
      return;
    }

    if (materials.length === 0) {
      notifyWarning(
        "Adicione ao menos um material."
      );
      return;
    }

    const invalidMaterial =
      materials.find(
        (material) =>
          material.estimatedQuantity !==
            undefined &&
          material.estimatedQuantity <= 0
      );

    if (invalidMaterial) {
      notifyWarning(
        `Informe uma quantidade válida para ${invalidMaterial.name}.`
      );
      return;
    }

    try {
      setSubmitting(true);

      await scheduleService.create({
        cooperativeId,
        generatorId:
          currentUser.generator?.id,
        preferredDate,
        requestedMaterials:
          materials.map((material) => ({
            wasteTypeId:
              material.wasteTypeId,
            proposedMaterial:
              material.proposedMaterial,
            estimatedQuantity:
              material.estimatedQuantity,
            unit:
              material.unit,
          })),
        notes:
          notes.trim() ||
          undefined,
      });

      notifySuccess(
        "Solicitação de coleta registrada com sucesso!"
      );

      router.replace(
        "/(gerador)/dashboard"
      );
    } catch (error) {
      console.error(
        "Erro ao solicitar coleta:",
        error
      );

      notifyError(
        error instanceof Error
          ? error.message
          : "Não foi possível registrar a solicitação."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#F3F4F6",
      }}
    >
      <LinearGradient
        colors={[
          "#10F35D",
          "#028C56",
        ]}
        start={{
          x: 0,
          y: 0,
        }}
        end={{
          x: 1,
          y: 0,
        }}
        style={{
          paddingTop: 22,
          paddingBottom: 20,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
        }}
      >
        <Text
          style={{
            fontSize: 24,
            fontWeight: "800",
            color: "#FFFFFF",
          }}
        >
          Solicitar coleta
        </Text>

        <Text
          style={{
            marginTop: 8,
            color: "#E8FFF1",
            fontSize: 14,
            lineHeight: 20,
          }}
        >
          Escolha os materiais, informe uma quantidade aproximada e indique o melhor horário.
        </Text>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 40,
        }}
      >
        <SectionCard
          title="Data preferencial"
          icon="calendar-outline"
        >
          <View
            style={{
              flexDirection: "row",
            }}
          >
            <TextInput
              value={selectedDate}
              onChangeText={(value) =>
                setSelectedDate(
                  formatDateInput(value)
                )
              }
              placeholder="DD/MM/AAAA"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              maxLength={10}
              style={[
                inputStyle,
                {
                  flex: 1,
                  marginRight: 10,
                },
              ]}
            />

            <TextInput
              value={selectedTime}
              onChangeText={(value) =>
                setSelectedTime(
                  formatTimeInput(value)
                )
              }
              placeholder="HH:MM"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              maxLength={5}
              style={[
                inputStyle,
                {
                  width: 105,
                },
              ]}
            />
          </View>
        </SectionCard>

        <SectionCard
          title="Catálogo de resíduos"
          icon="search-outline"
        >
          <TextInput
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Buscar material, categoria ou código"
            placeholderTextColor="#9CA3AF"
            style={inputStyle}
          />

          {catalogLoading ? (
            <View
              style={{
                paddingVertical: 26,
                alignItems: "center",
              }}
            >
              <ActivityIndicator
                color="#028C56"
              />
              <Text
                style={{
                  marginTop: 8,
                  color: "#6B7280",
                }}
              >
                Carregando catálogo...
              </Text>
            </View>
          ) : catalogError ? (
            <View
              style={{
                marginTop: 12,
                padding: 14,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "#F59E0B",
                backgroundColor: "#FFFBEB",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                }}
              >
                <Ionicons
                  name="warning-outline"
                  size={22}
                  color="#B45309"
                />

                <View
                  style={{
                    flex: 1,
                    marginLeft: 10,
                  }}
                >
                  <Text
                    style={{
                      color: "#92400E",
                      fontSize: 14,
                      fontWeight: "700",
                    }}
                  >
                    Catálogo temporariamente indisponível
                  </Text>

                  <Text
                    style={{
                      marginTop: 5,
                      color: "#92400E",
                      fontSize: 13,
                      lineHeight: 19,
                    }}
                  >
                    {catalogError}
                  </Text>

                  <Text
                    style={{
                      marginTop: 7,
                      color: "#78350F",
                      fontSize: 13,
                      lineHeight: 19,
                    }}
                  >
                    Você ainda pode continuar usando a opção
                    “Material não encontrado” abaixo.
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() =>
                  void loadCatalog()
                }
                disabled={catalogLoading}
                style={{
                  marginTop: 12,
                  minHeight: 42,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: "#B45309",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                }}
              >
                <Ionicons
                  name="refresh-outline"
                  size={18}
                  color="#B45309"
                />

                <Text
                  style={{
                    marginLeft: 7,
                    color: "#B45309",
                    fontWeight: "700",
                  }}
                >
                  Tentar carregar novamente
                </Text>
              </TouchableOpacity>
            </View>
          ) : filteredCatalogItems.length > 0 ? (
            <View
              style={{
                marginTop: 12,
              }}
            >
              {filteredCatalogItems
                .slice(0, 30)
                .map((item) => {
                  const selected =
                    isCatalogItemSelected(
                      item.id
                    );

                  return (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() =>
                        addCatalogItem(
                          item
                        )
                      }
                      disabled={selected}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 12,
                        borderBottomWidth: 1,
                        borderBottomColor:
                          "#E5E7EB",
                        opacity: selected
                          ? 0.55
                          : 1,
                      }}
                    >
                      <View
                        style={{
                          flex: 1,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 15,
                            fontWeight: "700",
                            color: "#111827",
                          }}
                        >
                          {item.name}
                        </Text>

                        <Text
                          style={{
                            marginTop: 3,
                            fontSize: 13,
                            color: "#6B7280",
                          }}
                        >
                          {[
                            item.category,
                            item.subcategory,
                          ]
                            .filter(Boolean)
                            .join(" • ") ||
                            "Sem categoria"}
                        </Text>
                      </View>

                      <Text
                        style={{
                          marginRight: 10,
                          color: "#4B5563",
                          fontWeight: "600",
                        }}
                      >
                        {getUnitLabel(
                          getCatalogItemUnit(
                            item
                          )
                        )}
                      </Text>

                      <Ionicons
                        name={
                          selected
                            ? "checkmark-circle"
                            : "add-circle-outline"
                        }
                        size={24}
                        color="#028C56"
                      />
                    </TouchableOpacity>
                  );
                })}
            </View>
          ) : (
            <View
              style={{
                paddingVertical: 20,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: "#6B7280",
                  textAlign: "center",
                }}
              >
                Nenhum material encontrado no catálogo.
              </Text>
            </View>
          )}

          <TouchableOpacity
            onPress={() =>
              setShowNewMaterialForm(
                (current) => !current
              )
            }
            style={{
              marginTop: 14,
              paddingVertical: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#028C56",
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
            }}
          >
            <Ionicons
              name="create-outline"
              size={18}
              color="#028C56"
            />
            <Text
              style={{
                marginLeft: 8,
                color: "#028C56",
                fontWeight: "700",
              }}
            >
              Material não encontrado
            </Text>
          </TouchableOpacity>

          {showNewMaterialForm ? (
            <View
              style={{
                marginTop: 14,
                padding: 14,
                borderRadius: 14,
                backgroundColor: "#F0FDF4",
              }}
            >
              <TextInput
                value={proposedForm.name}
                onChangeText={(name) =>
                  setProposedForm(
                    (current) => ({
                      ...current,
                      name,
                    })
                  )
                }
                placeholder="Nome do material"
                placeholderTextColor="#9CA3AF"
                style={inputStyle}
              />

              <TextInput
                value={proposedForm.category}
                onChangeText={(category) =>
                  setProposedForm(
                    (current) => ({
                      ...current,
                      category,
                    })
                  )
                }
                placeholder="Categoria"
                placeholderTextColor="#9CA3AF"
                style={[
                  inputStyle,
                  {
                    marginTop: 10,
                  },
                ]}
              />

              <TextInput
                value={proposedForm.subcategory}
                onChangeText={(subcategory) =>
                  setProposedForm(
                    (current) => ({
                      ...current,
                      subcategory,
                    })
                  )
                }
                placeholder="Subcategoria, se houver"
                placeholderTextColor="#9CA3AF"
                style={[
                  inputStyle,
                  {
                    marginTop: 10,
                  },
                ]}
              />

              <TextInput
                value={
                  proposedForm.estimatedQuantity
                }
                onChangeText={(
                  estimatedQuantity
                ) =>
                  setProposedForm(
                    (current) => ({
                      ...current,
                      estimatedQuantity:
                        normalizeDecimalInput(
                          estimatedQuantity
                        ),
                    })
                  )
                }
                placeholder="Quantidade estimada, opcional"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                style={[
                  inputStyle,
                  {
                    marginTop: 10,
                  },
                ]}
              />

              <UnitSelector
                value={proposedForm.unit}
                onChange={(unit) =>
                  setProposedForm(
                    (current) => ({
                      ...current,
                      unit,
                    })
                  )
                }
              />

              <View
                style={{
                  flexDirection: "row",
                  marginTop: 12,
                }}
              >
                <TouchableOpacity
                  onPress={resetProposedForm}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: "#D1D5DB",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 8,
                  }}
                >
                  <Text
                    style={{
                      color: "#4B5563",
                      fontWeight: "700",
                    }}
                  >
                    Cancelar
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={addProposedMaterial}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 10,
                    backgroundColor: "#028C56",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontWeight: "700",
                    }}
                  >
                    Adicionar
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </SectionCard>

        <SectionCard
          title={`Materiais selecionados (${materials.length})`}
          icon="list-outline"
        >
          {materials.length === 0 ? (
            <Text
              style={{
                color: "#6B7280",
                lineHeight: 20,
              }}
            >
              Selecione materiais do catálogo ou cadastre um material não encontrado.
            </Text>
          ) : (
            materials.map((material) => (
              <View
                key={material.localId}
                style={{
                  marginBottom: 12,
                  padding: 14,
                  borderRadius: 14,
                  backgroundColor: "#F9FAFB",
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "800",
                        color: "#111827",
                      }}
                    >
                      {material.name}
                    </Text>

                    <Text
                      style={{
                        marginTop: 3,
                        fontSize: 12,
                        color: "#6B7280",
                      }}
                    >
                      {material.source ===
                      "CATALOG"
                        ? "Catálogo oficial"
                        : "Material proposto"}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() =>
                      removeMaterial(
                        material.localId
                      )
                    }
                  >
                    <Ionicons
                      name="trash-outline"
                      size={20}
                      color="#DC2626"
                    />
                  </TouchableOpacity>
                </View>

                <TextInput
                  value={
                    material.estimatedQuantity ===
                    undefined
                      ? ""
                      : String(
                          material.estimatedQuantity
                        )
                  }
                  onChangeText={(value) =>
                    updateMaterialQuantity(
                      material.localId,
                      value
                    )
                  }
                  placeholder="Quantidade estimada, opcional"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                  style={[
                    inputStyle,
                    {
                      marginTop: 12,
                    },
                  ]}
                />

                <UnitSelector
                  value={material.unit}
                  onChange={(unit) =>
                    updateMaterialUnit(
                      material.localId,
                      unit
                    )
                  }
                />
              </View>
            ))
          )}
        </SectionCard>

        <SectionCard
          title="Observações"
          icon="document-text-outline"
        >
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Ex.: materiais separados, acesso lateral, horário de funcionamento..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            style={[
              inputStyle,
              {
                minHeight: 110,
              },
            ]}
          />
        </SectionCard>

        <TouchableOpacity
          activeOpacity={0.9}
          disabled={submitting}
          onPress={handleSchedule}
        >
          <LinearGradient
            colors={[
              "#10F35D",
              "#028C56",
            ]}
            start={{
              x: 0,
              y: 0,
            }}
            end={{
              x: 1,
              y: 0,
            }}
            style={{
              height: 56,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              opacity: submitting
                ? 0.7
                : 1,
            }}
          >
            {submitting ? (
              <>
                <ActivityIndicator
                  color="#FFFFFF"
                />
                <Text
                  style={{
                    marginLeft: 8,
                    color: "#FFFFFF",
                    fontSize: 17,
                    fontWeight: "800",
                  }}
                >
                  Enviando...
                </Text>
              </>
            ) : (
              <>
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 17,
                    fontWeight: "800",
                  }}
                >
                  Solicitar coleta
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={20}
                  color="#FFFFFF"
                  style={{
                    marginLeft: 8,
                  }}
                />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

/*
 * ============================================================
 * COMPONENTES
 * ============================================================
 */

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: "#E5E7EB",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: "#DCFCE7",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 10,
          }}
        >
          <Ionicons
            name={icon}
            size={19}
            color="#15803D"
          />
        </View>

        <Text
          style={{
            flex: 1,
            fontSize: 17,
            fontWeight: "800",
            color: "#111827",
          }}
        >
          {title}
        </Text>
      </View>

      {children}
    </View>
  );
}

function UnitSelector({
  value,
  onChange,
}: {
  value: WasteUnit;
  onChange: (unit: WasteUnit) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingTop: 10,
      }}
    >
      {WASTE_UNITS.map((unit) => {
        const selected =
          unit.value === value;

        return (
          <TouchableOpacity
            key={unit.value}
            onPress={() =>
              onChange(unit.value)
            }
            style={{
              paddingHorizontal: 13,
              paddingVertical: 9,
              borderRadius: 18,
              marginRight: 8,
              backgroundColor: selected
                ? "#028C56"
                : "#FFFFFF",
              borderWidth: 1,
              borderColor: selected
                ? "#028C56"
                : "#D1D5DB",
            }}
          >
            <Text
              style={{
                color: selected
                  ? "#FFFFFF"
                  : "#4B5563",
                fontWeight: "700",
              }}
            >
              {unit.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const inputStyle = {
  borderWidth: 1,
  borderColor: "#D1D5DB",
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 13,
  fontSize: 15,
  color: "#111827",
  backgroundColor: "#FFFFFF",
} as const;
